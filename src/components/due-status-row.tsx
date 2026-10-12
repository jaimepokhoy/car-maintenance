import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatDate, formatDistance, type DueState, type DueStatus } from '@/domain';
import { useLocale } from '@/hooks/use-locale';
import { useTheme } from '@/hooks/use-theme';

export function useDueStateColor(state: DueState): string {
  const theme = useTheme();
  return {
    overdue: theme.danger,
    due_soon: theme.warning,
    ok: theme.success,
    unknown: theme.textSecondary,
  }[state];
}

export function DueStatusRow({ status }: { status: DueStatus }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const color = useDueStateColor(status.state);

  const limits = [
    status.dueOn ? formatDate(status.dueOn, locale) : null,
    status.dueAtKm !== undefined ? formatDistance(status.dueAtKm, 'km', locale) : null,
  ]
    .filter(Boolean)
    .join(t('due.or'));

  const detail =
    status.state === 'unknown'
      ? t('due.unknown')
      : t(status.state === 'overdue' ? 'due.wasDueBy' : 'due.dueBy', { limits });

  return (
    <View style={styles.row} accessible>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={styles.name}>
          {t(`items.${status.itemId}`)}
        </ThemedText>
        <ThemedText type="small" style={{ color }}>
          {t(`dueState.${status.state}`)}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {detail}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.half,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  name: {
    flexShrink: 1,
  },
});
