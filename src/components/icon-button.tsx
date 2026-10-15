import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Control, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A round icon-only button. Always pass `accessibilityLabel`. `outlined`
 * sits on a surface; `plain` is for header and row affordances; `accent` is
 * a primary action; `inverse` is a filled chevron.
 */
export function IconButton({
  icon,
  variant = 'plain',
  size = Control.touch,
  iconSize = 20,
  color,
  style,
  accessibilityLabel,
  ...props
}: PressableProps & {
  icon: IconName;
  variant?: 'plain' | 'outlined' | 'accent' | 'inverse';
  size?: number;
  iconSize?: number;
  color?: string;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const palette = {
    plain: { bg: 'transparent', border: 'transparent', fg: theme.text },
    outlined: { bg: theme.surface, border: theme.borderStrong, fg: theme.text },
    accent: { bg: theme.accent, border: theme.accent, fg: theme.onAccent },
    inverse: { bg: theme.inverse, border: theme.inverse, fg: theme.onInverse },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={size < Control.touch ? (Control.touch - size) / 2 : undefined}
      {...props}
      style={(state) => [
        styles.base,
        {
          width: size,
          height: size,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: state.pressed || props.disabled ? 0.7 : 1,
        },
        (typeof style === 'function' ? style(state) : style) as StyleProp<ViewStyle>,
      ]}>
      <Icon name={icon} size={iconSize} color={color ?? palette.fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.pill,
  },
});
