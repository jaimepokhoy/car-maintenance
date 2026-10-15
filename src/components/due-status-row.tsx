import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon, ITEM_ICONS } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { useDueStateColors } from '@/components/status-pill';
import { ThemedText } from '@/components/themed-text';
import { Control, Spacing } from '@/constants/theme';
import { describeDuration, remainingLimits, type DueStatus } from '@/domain';
import { useFormat } from '@/hooks/use-format';

/** "612 km overdue", "In 900 km · 5 weeks", or the prompt to log a first time. */
export function useDueDetail() {
  const { t } = useTranslation();
  const format = useFormat();

  return (status: DueStatus): string => {
    if (status.state === 'unknown') return t('dueState.unknown');
    const limits = remainingLimits(status);
    const phrase = (limit: (typeof limits)[number]) => {
      if (limit.kind === 'km') {
        const distance = format.distance(Math.abs(limit.value));
        return limit.value < 0 ? t('due.overdueBy', { amount: distance }) : t('due.in', { amount: distance });
      }
      const duration = describeDuration(limit.value);
      const amount = t(`duration.${duration.unit}`, { count: duration.count });
      return limit.value < 0 ? t('due.overdueBy', { amount }) : t('due.in', { amount });
    };
    // Overdue and due soon name the one limit that triggered them; an item in
    // good standing shows both so the owner can plan.
    const shown = status.state === 'ok' ? limits : limits.slice(0, 1);
    return shown.map(phrase).join(t('due.separator'));
  };
}

/**
 * One maintenance item: its icon in a tile tinted by state (dashed when never
 * logged), the item name and how far it is from due. Tapping the row opens
 * the log form for that item (`onLog`); items already being tracked also get
 * a one-tap "done today".
 */
export function DueStatusRow({
  status,
  emphasis = 'primary',
  onDoneToday,
  onLog,
  onLearnMore,
}: {
  status: DueStatus;
  /** `quiet` when the screen already carries a cyan primary action: the row gets an outlined check instead. */
  emphasis?: 'primary' | 'quiet';
  onDoneToday?: () => void;
  onLog?: () => void;
  onLearnMore?: () => void;
}) {
  const { t } = useTranslation();
  const colors = useDueStateColors(status.state);
  const detail = useDueDetail()(status);
  const name = t(`items.${status.itemId}`);

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole={onLog ? 'button' : undefined}
        accessibilityLabel={`${name}, ${detail}`}
        accessibilityHint={onLog ? t('vehicle.logHint') : undefined}
        disabled={!onLog}
        onPress={onLog}
        style={({ pressed }) => [styles.target, pressed && { opacity: 0.7 }]}>
      <View
        style={[
          styles.tile,
          status.state === 'unknown'
            ? { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.mark }
            : { backgroundColor: colors.tint },
        ]}
        aria-hidden>
        <Icon name={ITEM_ICONS[status.itemId]} size={18} color={colors.text} />
      </View>
      <View style={styles.text}>
        <ThemedText type="bodyStrong">{name}</ThemedText>
        <ThemedText type="small" style={{ color: status.state === 'ok' ? undefined : colors.text }} themeColor="textSecondary">
          {detail}
        </ThemedText>
      </View>
      {status.state === 'unknown' && onLog ? <Icon name="forward" size={18} color={colors.text} /> : null}
      </Pressable>
      {onLearnMore ? (
        <IconButton
          icon="info"
          accessibilityLabel={t('vehicle.aboutItem', { item: name })}
          color={colors.text}
          onPress={onLearnMore}
        />
      ) : null}
      {status.state !== 'unknown' && onDoneToday ? (
        status.state === 'ok' || emphasis === 'quiet' ? (
          <IconButton
            icon="check"
            variant="outlined"
            accessibilityLabel={t('vehicle.doneTodayItem', { item: name })}
            onPress={onDoneToday}
          />
        ) : (
          <Button title={t('vehicle.doneToday')} size="small" onPress={onDoneToday} />
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.one,
    flex: 1,
  },
  target: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.one,
    minHeight: Control.touch,
  },
  tile: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
});
