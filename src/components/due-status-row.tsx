import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

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

export function DueStatusRow({
  status,
  onDoneToday,
  onLog,
  onLearnMore,
}: {
  status: DueStatus;
  onDoneToday?: () => void;
  onLog?: () => void;
  onLearnMore?: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const color = useDueStateColor(status.state);
  const theme = useTheme();
  const action =
    status.state === 'unknown'
      ? onLog && { label: t('vehicle.logIt'), onPress: onLog }
      : onDoneToday && { label: t('vehicle.doneToday'), onPress: onDoneToday };

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
    <View style={styles.row}>
      <Pressable
        style={styles.header}
        onPress={onLearnMore}
        disabled={!onLearnMore}
        accessibilityRole={onLearnMore ? 'button' : undefined}
        accessibilityHint={onLearnMore ? t('vehicle.learnMore') : undefined}>
        <ThemedText type="smallBold" style={styles.name}>
          {t(`items.${status.itemId}`)}
          {onLearnMore ? <ThemedText type="small" style={{ color: theme.tint }}>{'  ⓘ'}</ThemedText> : null}
        </ThemedText>
        <ThemedText type="small" style={{ color }}>
          {t(`dueState.${status.state}`)}
        </ThemedText>
      </Pressable>
      <View style={styles.footer}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.detail}>
          {detail}
        </ThemedText>
        {action ? (
          <Pressable accessibilityRole="button" onPress={action.onPress} hitSlop={Spacing.two}>
            <ThemedText type="smallBold" style={{ color: theme.tint }}>
              {action.label}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  detail: {
    flexShrink: 1,
  },
});
