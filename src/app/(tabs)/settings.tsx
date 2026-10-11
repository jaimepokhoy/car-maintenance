import Constants from 'expo-constants';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { PROVINCES } from '@/domain';
import { usePreferences } from '@/hooks/use-preferences';
import { shareServiceHistory } from '@/lib/export';

export default function SettingsScreen() {
  const { t } = useTranslation();
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

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="small">{t('export.title')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('export.hint')}
        </ThemedText>
        <Button title={t('export.button')} onPress={exportHistory} disabled={exporting} />
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
