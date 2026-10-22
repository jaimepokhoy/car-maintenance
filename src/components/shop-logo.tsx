import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Control, Radius, Spacing } from '@/constants/theme';
import { useTenant } from '@/hooks/use-tenant';
import { useTheme } from '@/hooks/use-theme';
import { isBrandedBuild } from '@/lib/tenant-config';

/** The shop's logo from its portal profile, on a surface tile. Renders nothing in the unbranded app. */
export function ShopLogo() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { profile } = useTenant();
  const uri = profile?.brand.logoUrl;
  if (!isBrandedBuild || !profile || !uri) return null;

  return (
    <View style={[styles.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Image
        source={{ uri }}
        contentFit="contain"
        accessibilityLabel={t('garage.shopLogo', { name: profile.name })}
        style={styles.image}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: Control.touch,
    height: Control.touch,
    borderRadius: Radius.field,
    borderWidth: 1,
    padding: Spacing.one,
  },
  image: {
    flex: 1,
  },
});
