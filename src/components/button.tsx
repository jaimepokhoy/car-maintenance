import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Button({ title, style, ...props }: PressableProps & { title: string }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      // `<Link asChild>` passes its own `style` (an empty object), so ours must win rather than be
      // spread over; otherwise the button loses its background and its label vanishes.
      style={(state) => [
        styles.button,
        { backgroundColor: theme.tint, opacity: state.pressed || props.disabled ? 0.7 : 1 },
        (typeof style === 'function' ? style(state) : style) as StyleProp<ViewStyle>,
      ]}>
      <ThemedText type="smallBold" style={{ color: theme.onTint }}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
});
