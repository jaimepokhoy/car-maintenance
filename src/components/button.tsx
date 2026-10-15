import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Control, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive';

/**
 * A pill button. `primary` is the one cyan action on a screen; `secondary`
 * is outlined; `destructive` is a tinted red for deletes. `size="small"`
 * fits inside list rows.
 */
export function Button({
  title,
  variant = 'primary',
  size = 'default',
  icon,
  loading,
  style,
  disabled,
  ...props
}: PressableProps & {
  title: string;
  variant?: ButtonVariant;
  size?: 'small' | 'default' | 'large';
  icon?: ReactNode;
  loading?: boolean;
}) {
  const theme = useTheme();
  const palette = {
    primary: { bg: theme.accent, fg: theme.onAccent, border: theme.accent },
    secondary: { bg: theme.surface, fg: theme.text, border: theme.borderStrong },
    destructive: { bg: theme.dangerTint, fg: theme.dangerText, border: theme.dangerTint },
  }[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      {...props}
      // `<Link asChild>` passes its own `style` (an empty object), so ours must win rather than be
      // spread over; otherwise the button loses its background and its label vanishes.
      style={(state) => [
        styles.base,
        styles[size],
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: state.pressed || inactive ? 0.7 : 1 },
        (typeof style === 'function' ? style(state) : style) as StyleProp<ViewStyle>,
      ]}>
      {loading ? <ActivityIndicator color={palette.fg} /> : icon}
      <ThemedText type={size === 'small' ? 'smallStrong' : 'bodyStrong'} style={{ color: palette.fg }} numberOfLines={1}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.pill,
  },
  small: {
    minHeight: Control.touch,
    paddingHorizontal: Spacing.three,
  },
  default: {
    minHeight: Control.height,
    paddingHorizontal: Spacing.four,
  },
  large: {
    minHeight: Control.heightLarge,
    paddingHorizontal: Spacing.four,
  },
});
