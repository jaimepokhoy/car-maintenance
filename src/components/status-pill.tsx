import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { DueState } from '@/domain';
import { useTheme } from '@/hooks/use-theme';

/** Colours for a due state: the solid mark, the text shade and the translucent fill. */
export function useDueStateColors(state: DueState) {
  const theme = useTheme();
  return {
    overdue: { mark: theme.danger, text: theme.dangerText, tint: theme.dangerTint },
    due_soon: { mark: theme.warning, text: theme.warningText, tint: theme.warningTint },
    ok: { mark: theme.success, text: theme.successText, tint: theme.successTint },
    unknown: { mark: theme.textSecondary, text: theme.textSecondary, tint: theme.surfaceRaised },
  }[state];
}

/** A small tinted pill with a dot: "1 overdue", "Due soon", "All clear". */
export function StatusPill({ state, label }: { state: DueState; label: string }) {
  const colors = useDueStateColors(state);
  return (
    <View style={[styles.pill, { backgroundColor: colors.tint }]}>
      <View style={[styles.dot, { backgroundColor: colors.mark }]} />
      <ThemedText type="smallStrong" style={{ color: colors.text }} numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two - Spacing.half,
    paddingVertical: Spacing.one + Spacing.half,
    paddingHorizontal: Spacing.two + Spacing.half,
    borderRadius: Radius.pill,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
