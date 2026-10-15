import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Control, Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A labelled input. `prefix` and `suffix` sit inside the field for units
 * ("$", "km"). `size="large"` is for the one number a screen is about, like
 * the odometer.
 */
export function TextField({
  label,
  hint,
  error,
  prefix,
  suffix,
  size = 'default',
  style,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  prefix?: string;
  suffix?: string;
  size?: 'default' | 'large';
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? theme.danger : focused ? theme.accent : theme.borderStrong;

  return (
    <View style={styles.field}>
      <ThemedText type="label" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View
        style={[
          styles.frame,
          size === 'large' && styles.frameLarge,
          { backgroundColor: theme.surface, borderColor, borderWidth: focused || error ? 2 : 1 },
          props.multiline && styles.frameMultiline,
        ]}>
        {prefix ? (
          <ThemedText type={size === 'large' ? 'numeral' : 'body'} themeColor="textSecondary">
            {prefix}
          </ThemedText>
        ) : null}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={theme.textSecondary}
          selectionColor={theme.accent}
          cursorColor={theme.accent}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...props}
          style={[
            styles.input,
            size === 'large' && styles.inputLarge,
            props.multiline && styles.inputMultiline,
            { color: theme.text },
            style,
          ]}
        />
        {suffix ? (
          <ThemedText type="small" themeColor="textSecondary">
            {suffix}
          </ThemedText>
        ) : null}
      </View>
      {error ? (
        <ThemedText type="caption" themeColor="dangerText" accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : hint ? (
        <ThemedText type="caption" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two - Spacing.half,
  },
  frame: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: Control.height,
    paddingHorizontal: Spacing.three - Spacing.half,
    borderRadius: Radius.field,
  },
  frameLarge: {
    minHeight: Control.heightLarge + Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  frameMultiline: {
    alignItems: 'flex-start',
    paddingVertical: Spacing.two + Spacing.one,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: Control.height - 2,
    paddingVertical: 0,
    fontFamily: Fonts.bodyMedium,
    fontSize: 17,
  },
  inputLarge: {
    minHeight: Control.heightLarge + Spacing.one - 2,
    fontFamily: Fonts.displayBold,
    fontSize: 24,
    fontVariant: ['tabular-nums'],
  },
  inputMultiline: {
    minHeight: Control.height * 1.5,
    textAlignVertical: 'top',
  },
});
