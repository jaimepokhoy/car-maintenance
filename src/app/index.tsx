import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function GarageScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('garage.title')}>
      <ThemedView type="backgroundElement" style={styles.empty}>
        <ThemedText type="smallBold">{t('garage.emptyTitle')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('garage.emptyBody')}
        </ThemedText>
      </ThemedView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: {
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
});
