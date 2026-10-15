import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A raised surface with a hairline border. `padded` cards hold content;
 * `list` cards hold `CardRow`s edge to edge; `hero` cards are vehicle cards.
 */
export function Card({
  variant = 'padded',
  style,
  children,
  ...props
}: PropsWithChildren<ViewProps & { variant?: 'padded' | 'list' | 'hero'; style?: StyleProp<ViewStyle> }>) {
  const theme = useTheme();
  return (
    <View
      {...props}
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
        variant === 'padded' && styles.padded,
        variant === 'hero' && styles.hero,
        style,
      ]}>
      {children}
    </View>
  );
}

/** One row of a `list` card, separated from the next by a hairline. */
export function CardRow({
  last,
  style,
  children,
  ...props
}: PropsWithChildren<ViewProps & { last?: boolean; style?: StyleProp<ViewStyle> }>) {
  const theme = useTheme();
  return (
    <View {...props} style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: theme.border }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  padded: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  hero: {
    borderRadius: Radius.hero,
    padding: Spacing.gutter,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - Spacing.one,
    paddingVertical: Spacing.two + Spacing.one,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two + Spacing.one,
  },
});
