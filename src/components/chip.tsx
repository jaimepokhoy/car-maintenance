import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Control, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** A toggle pill. Selected chips fill with the text colour and gain a check. */
export function Chip({
  label,
  selected,
  onPress,
  role = 'checkbox',
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** `radio` when exactly one chip in the group can be on. */
  role?: 'checkbox' | 'radio';
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected
          ? { backgroundColor: theme.inverse, borderColor: theme.inverse }
          : { backgroundColor: theme.surface, borderColor: theme.borderStrong },
        pressed && { opacity: 0.7 },
      ]}>
      {selected ? <Icon name="check" size={14} color={theme.onInverse} weight="bold" /> : null}
      <ThemedText type={selected ? 'smallStrong' : 'small'} style={{ color: selected ? theme.onInverse : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two - Spacing.half,
    minHeight: Control.touch,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
});
