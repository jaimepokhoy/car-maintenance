import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { PROVINCES } from '@/domain';
import { usePreferences } from '@/hooks/use-preferences';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { preferences, update } = usePreferences();

  return (
    <Screen title={t('settings.title')}>
      <ThemedView type="backgroundElement" style={styles.card}>
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
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="small">{t('settings.province')}</ThemedText>
        <View style={styles.chips}>
          {PROVINCES.map((province) => (
            <Chip
              key={province}
              label={t(`provinces.${province}`)}
              selected={preferences.province === province}
              onPress={() =>
                update('province', preferences.province === province ? undefined : province)
              }
            />
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {t('settings.provinceHint')}
        </ThemedText>
      </ThemedView>

      <View style={styles.row}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('settings.version')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {Constants.expoConfig?.version ?? '–'}
        </ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
  },
});
