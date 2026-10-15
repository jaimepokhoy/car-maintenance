import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The type scale. Titles, names and numbers use the condensed display face;
 * everything the owner reads uses Barlow.
 *
 * - `display`: screen titles and vehicle names, uppercase.
 * - `headline`: inline titles on pushed and modal screens, uppercase.
 * - `numeral` / `numeralLarge`: odometer readings, costs, the hero figure. Tabular.
 * - `label`: small uppercase section and field labels.
 * - `body` / `bodyStrong`, `small` / `smallStrong`, `caption`: reading sizes.
 */
export type TextType =
  | 'display'
  | 'headline'
  | 'numeral'
  | 'numeralLarge'
  | 'numeralCompact'
  | 'label'
  | 'body'
  | 'bodyStrong'
  | 'small'
  | 'smallStrong'
  | 'caption';

export type ThemedTextProps = TextProps & {
  type?: TextType;
  themeColor?: ThemeColor;
};

/** Display sizes stop scaling earlier so a hero number never pushes its controls off screen. */
const DISPLAY_MAX_SCALE = 1.5;

export function ThemedText({ style, type = 'body', themeColor = 'text', ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const isDisplay =
    type === 'display' || type === 'headline' || type === 'numeral' || type === 'numeralLarge' || type === 'numeralCompact';

  return (
    <Text
      maxFontSizeMultiplier={isDisplay ? DISPLAY_MAX_SCALE : undefined}
      {...rest}
      style={[{ color: theme[themeColor] }, styles[type], style]}
    />
  );
}

const styles = StyleSheet.create({
  display: {
    fontFamily: Fonts.display,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  headline: {
    fontFamily: Fonts.display,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  numeral: {
    fontFamily: Fonts.displayBold,
    fontSize: 26,
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
  },
  numeralLarge: {
    fontFamily: Fonts.display,
    fontSize: 72,
    lineHeight: 76,
    fontVariant: ['tabular-nums'],
  },
  /** Money and figures inside rows and stat cards. */
  numeralCompact: {
    fontFamily: Fonts.displayBold,
    fontSize: 20,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  body: {
    fontFamily: Fonts.body,
    fontSize: 16,
    lineHeight: 24,
  },
  bodyStrong: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 16,
    lineHeight: 24,
  },
  small: {
    fontFamily: Fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  smallStrong: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
});
