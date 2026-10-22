import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { Icon } from '@/components/icon';
import { Screen, SectionLabel } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { PROVINCES } from '@/domain';
import { usePreferences } from '@/hooks/use-preferences';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { deleteAccount, signOut } from '@/lib/auth';
import { shareServiceHistory } from '@/lib/export';
import { supabase } from '@/lib/supabase';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { preferences, update } = usePreferences();
  const db = useSQLiteContext();
  const [exporting, setExporting] = useState(false);

  async function exportHistory() {
    setExporting(true);
    try {
      const shared = await shareServiceHistory(
        db,
        {
          unit: preferences.distanceUnit,
          headers: {
            vehicle: t('export.vehicle'),
            date: t('export.date'),
            services: t('export.services'),
            odometer: t('export.odometer', { unit: preferences.distanceUnit }),
            cost: t('export.cost'),
            currency: t('export.currency'),
            shop: t('export.shop'),
            notes: t('export.notes'),
          },
          itemLabel: (itemId) => t(`items.${itemId}`),
        },
        t('export.button'),
      );
      if (!shared) Alert.alert(t('export.unavailable'));
    } catch (error) {
      console.warn('Export failed', error);
      Alert.alert(t('export.failed'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <Screen title={t('settings.title')}>
      {/* Accounts need Supabase; without it the app is offline-only and there is nothing to sign in to. */}
      {supabase ? <AccountSection /> : null}

      <SectionLabel>{t('settings.preferences')}</SectionLabel>
      <Card style={styles.group}>
        <SegmentedControl
          label={t('settings.language')}
          value={preferences.language}
          onChange={(language) => update('language', language)}
          options={[
            { value: 'system', label: t('settings.languageSystem') },
            { value: 'en', label: 'English' },
            { value: 'fr', label: 'Français' },
          ]}
        />
        <SegmentedControl
          label={t('settings.distanceUnit')}
          value={preferences.distanceUnit}
          onChange={(distanceUnit) => update('distanceUnit', distanceUnit)}
          options={[
            { value: 'km', label: t('units.km') },
            { value: 'mi', label: t('units.mi') },
          ]}
        />
        <SegmentedControl
          label={t('settings.appearance')}
          value={preferences.appearance}
          onChange={(appearance) => update('appearance', appearance)}
          options={[
            { value: 'system', label: t('settings.appearanceSystem') },
            { value: 'dark', label: t('settings.appearanceDark') },
            { value: 'light', label: t('settings.appearanceLight') },
          ]}
        />
      </Card>

      <SectionLabel>{t('settings.reminders')}</SectionLabel>
      <Card>
        <View style={styles.text}>
          <ThemedText type="bodyStrong">{t('settings.province')}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {t('settings.provinceHint')}
          </ThemedText>
        </View>
        <View style={styles.chips}>
          {PROVINCES.map((province) => (
            <Chip
              key={province}
              role="radio"
              label={t(`provinces.${province}`)}
              selected={preferences.province === province}
              onPress={() => update('province', preferences.province === province ? undefined : province)}
            />
          ))}
        </View>
      </Card>

      <SectionLabel>{t('export.title')}</SectionLabel>
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          {t('export.hint')}
        </ThemedText>
        <Button
          title={t('export.button')}
          variant="secondary"
          icon={<Icon name="export" size={18} color={theme.text} />}
          onPress={exportHistory}
          loading={exporting}
        />
      </Card>

      <ThemedText type="caption" themeColor="textSecondary" style={styles.version}>
        {`${Constants.expoConfig?.name ?? ''} · ${t('settings.version')} ${Constants.expoConfig?.version ?? '–'}`}
      </ThemedText>
    </Screen>
  );
}

/** Sign in, or for a signed-in owner: who they are, sign out, and delete the account. */
function AccountSection() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { session, ready } = useSession();
  const [busy, setBusy] = useState<'signOut' | 'delete'>();

  async function leave() {
    setBusy('signOut');
    try {
      await signOut();
    } finally {
      setBusy(undefined);
    }
  }

  function confirmDelete() {
    Alert.alert(t('account.deleteConfirmTitle'), t('account.deleteConfirmBody'), [
      { text: t('account.cancel'), style: 'cancel' },
      {
        text: t('account.deleteConfirm'),
        style: 'destructive',
        onPress: async () => {
          setBusy('delete');
          try {
            const result = await deleteAccount();
            Alert.alert(result.ok ? t('account.deleted') : t('account.deleteFailed'));
          } finally {
            setBusy(undefined);
          }
        },
      },
    ]);
  }

  if (!ready) return null;

  return (
    <>
      <SectionLabel>{t('account.title')}</SectionLabel>
      {session ? (
        <Card>
          <View style={styles.text}>
            <ThemedText type="caption" themeColor="textSecondary">
              {t('account.signedInAs')}
            </ThemedText>
            <ThemedText type="bodyStrong" numberOfLines={1}>
              {session.user.email ?? t('account.noEmail')}
            </ThemedText>
          </View>
          <Button
            title={t('account.signOut')}
            variant="secondary"
            icon={<Icon name="signOut" size={18} color={theme.text} />}
            onPress={leave}
            loading={busy === 'signOut'}
            disabled={!!busy}
          />
          <Button
            title={t('account.delete')}
            variant="destructive"
            onPress={confirmDelete}
            loading={busy === 'delete'}
            disabled={!!busy}
          />
        </Card>
      ) : (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            {t('account.signedOutHint')}
          </ThemedText>
          <Button
            title={t('account.signIn')}
            icon={<Icon name="account" size={18} color={theme.onAccent} />}
            onPress={() => router.push('/sign-in')}
          />
        </Card>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.four - Spacing.one,
  },
  text: {
    gap: Spacing.half,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  version: {
    textAlign: 'center',
    paddingTop: Spacing.two,
  },
});
