import { randomUUID } from 'expo-crypto';
import { Redirect, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon, type IconName } from '@/components/icon';
import { FormScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { cacheTenantNames, listCustomerLinks, saveCustomerLink, setConsentDeclined } from '@/db/customer-links';
import { grantConsent } from '@/domain';
import { useSession } from '@/hooks/use-session';
import { useTenant } from '@/hooks/use-tenant';
import { useTheme } from '@/hooks/use-theme';

/**
 * Asks a branded app's customer whether to share their vehicles and service
 * history with the app's shop. Opened once after sign-in, and again from
 * Settings for a customer who said "not now" or stopped sharing.
 */
export default function ConsentScreen() {
  const { profile } = useTenant();
  const { session } = useSession();
  // Only reachable in a shop's app, signed in, once the shop's id is known.
  if (!profile?.id || !session) return <Redirect href="/settings" />;
  return <ConsentForm tenantId={profile.id} shopName={profile.name} />;
}

function ConsentForm({ tenantId, shopName }: { tenantId: string; shopName: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const db = useSQLiteContext();
  const [busy, setBusy] = useState<'share' | 'decline'>();

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  async function share() {
    setBusy('share');
    try {
      const now = new Date();
      await cacheTenantNames(db, [{ id: tenantId, name: shopName }]);
      await saveCustomerLink(db, grantConsent(await listCustomerLinks(db), tenantId, randomUUID(), now), now);
      close();
    } finally {
      setBusy(undefined);
    }
  }

  async function decline() {
    setBusy('decline');
    try {
      await setConsentDeclined(db, tenantId, new Date());
      close();
    } finally {
      setBusy(undefined);
    }
  }

  const points: { icon: IconName; text: string }[] = [
    { icon: 'carOutline', text: t('consent.sees') },
    { icon: 'receipt', text: t('consent.logs') },
    { icon: 'bell', text: t('consent.messages') },
    { icon: 'settings', text: t('consent.revoke') },
  ];

  return (
    <FormScreen
      footer={
        <View style={styles.actions}>
          <Button
            title={t('consent.share')}
            size="large"
            onPress={share}
            loading={busy === 'share'}
            disabled={!!busy}
          />
          <Button
            title={t('consent.notNow')}
            variant="secondary"
            onPress={decline}
            loading={busy === 'decline'}
            disabled={!!busy}
          />
        </View>
      }>
      <ThemedText type="headline" accessibilityRole="header">
        {t('consent.question', { shop: shopName })}
      </ThemedText>
      <Card style={styles.points}>
        {points.map((point) => (
          <View key={point.icon} style={styles.point}>
            <Icon name={point.icon} size={20} color={theme.accent} />
            <ThemedText type="small" style={styles.flex}>
              {point.text}
            </ThemedText>
          </View>
        ))}
      </Card>
      <ThemedText type="caption" themeColor="textSecondary">
        {t('consent.private')}
      </ThemedText>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  actions: {
    gap: Spacing.two,
  },
  points: {
    gap: Spacing.three,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
});
