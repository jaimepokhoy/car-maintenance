import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  GUIDANCE,
  resolveSchedule,
  type MaintenanceItemId,
  type Powertrain,
} from '@/domain';
import { useFormat } from '@/hooks/use-format';

export default function GuideScreen() {
  const { item, powertrain = 'gas' } = useLocalSearchParams<{
    item: MaintenanceItemId;
    powertrain?: Powertrain;
  }>();
  const { t } = useTranslation();
  const format = useFormat();
  const guidance = GUIDANCE[item];
  const interval = resolveSchedule(powertrain).find((i) => i.itemId === item);
  if (!guidance) return <ThemedView style={styles.flex} />;

  const limits = [
    interval?.everyKm !== undefined
      ? t('guidance.everyKm', { distance: format.distance(interval.everyKm) })
      : null,
    interval?.everyMonths !== undefined ? t('guidance.everyMonths', { months: interval.everyMonths }) : null,
  ].filter((limit): limit is string => limit !== null);
  const howOften =
    limits.length > 1 ? t('guidance.whicheverFirst', { limits: limits.join(t('due.or')) }) : limits[0];

  const [min, max] = guidance.costCents.map((cents) =>
    cents === 0 ? t('guidance.free') : format.money(cents),
  );

  const sections: [string, string | undefined][] = [
    [t('guidance.whatItIs'), t(`guidance.items.${item}.what`)],
    [t('guidance.whyItMatters'), t(`guidance.items.${item}.why`)],
    [t('guidance.howOften'), howOften],
    [t('guidance.typicalCost'), t('guidance.costRange', { min, max })],
    [t('guidance.doItYourself'), t(`guidance.diy.${guidance.diy}`)],
  ];

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen options={{ title: t(`items.${item}`) }} />
      <ScrollView contentContainerStyle={styles.content}>
        {sections.map(([heading, body]) =>
          body ? (
            <View key={heading} style={styles.section}>
              <ThemedText type="smallBold" accessibilityRole="header">
                {heading}
              </ThemedText>
              <ThemedText>{body}</ThemedText>
            </View>
          ) : null,
        )}
        <ThemedText type="small" themeColor="textSecondary">
          {t('guidance.disclaimer')}
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    gap: Spacing.four,
    padding: Spacing.four,
  },
  section: {
    gap: Spacing.one,
  },
});
