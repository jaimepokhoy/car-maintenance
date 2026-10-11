import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

// Read-only for now; editable preferences arrive with local storage.
export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const rows: [string, string][] = [
    [t('settings.language'), i18n.language === 'fr' ? 'Français' : 'English'],
    [t('settings.distanceUnit'), t('units.km')],
    [t('settings.currency'), 'CAD'],
    [t('settings.version'), Constants.expoConfig?.version ?? '–'],
  ];

  return (
    <Screen title={t('settings.title')}>
      <ThemedView type="backgroundElement" style={styles.card}>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <ThemedText type="small">{label}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {value}
            </ThemedText>
          </View>
        ))}
      </ThemedView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
