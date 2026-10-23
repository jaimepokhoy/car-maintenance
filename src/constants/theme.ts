/**
 * Design tokens for the "Night Drive" visual system: a near-black ground with
 * one cyan accent for primary actions, three status colours with translucent
 * tints, Barlow for text and Barlow Semi Condensed for titles and numbers.
 *
 * Screens never hard-code colours, radii or font names; they read them from
 * here through `useTheme()` and `ThemedText`. Add a token when a new role
 * appears, not a one-off value in a screen.
 *
 * `Colors` is the fixed Night Drive base. The accent role (`accent`,
 * `onAccent`) is a brand overlay: the shop's colours in a branded build,
 * `DefaultBrand` otherwise. `useTheme()` lays it over both schemes.
 */

import {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
} from '@expo-google-fonts/barlow';
import {
  BarlowSemiCondensed_700Bold,
  BarlowSemiCondensed_800ExtraBold,
} from '@expo-google-fonts/barlow-semi-condensed';

export const Colors = {
  dark: {
    /** Screen ground. */
    background: '#0A0C0F',
    /** Cards and fields. */
    surface: '#14181D',
    /** Segmented tracks and fields inside cards. */
    surfaceRaised: '#1C2128',
    border: '#262C34',
    /** Borders on controls that must read as tappable. */
    borderStrong: '#2E353E',
    text: '#F2F4F5',
    textSecondary: '#9AA3AD',
    /** Decorative strokes only, never text. */
    textFaint: '#5C6670',
    /** Selected segments and chips: a solid fill of the text colour. */
    inverse: '#F2F4F5',
    onInverse: '#0A0C0F',
    danger: '#FF5A4E',
    dangerText: '#FF7A70',
    dangerTint: 'rgba(255,90,78,0.14)',
    warning: '#FFB020',
    warningText: '#FFB020',
    warningTint: 'rgba(255,176,32,0.14)',
    success: '#5BD48A',
    successText: '#5BD48A',
    successTint: 'rgba(91,212,138,0.14)',
    /** Peak opacity of the accent wash rising from a vehicle card's bottom edge. */
    glow: 0.22,
    /** Floating tab bar fill. Opaque: content scrolling under it must not ghost through. */
    nav: '#1C2128',
    shadow: 'rgba(0,0,0,0.5)',
  },
  light: {
    background: '#F4F5F7',
    surface: '#FFFFFF',
    surfaceRaised: '#ECEEF1',
    border: '#DDE1E6',
    borderStrong: '#D3D8DE',
    text: '#0E1116',
    textSecondary: '#59616B',
    textFaint: '#9AA3AD',
    inverse: '#0E1116',
    onInverse: '#FFFFFF',
    danger: '#D92D20',
    dangerText: '#B42318',
    dangerTint: '#FDECEA',
    warning: '#E89400',
    warningText: '#8A5A00',
    warningTint: '#FFF4DB',
    success: '#2E9E5B',
    successText: '#1F7A44',
    successTint: '#E3F4EA',
    glow: 0.28,
    nav: '#FFFFFF',
    shadow: 'rgba(14,17,22,0.14)',
  },
} as const;

/** The accent role a shop's brand may override, the same in both schemes. */
export type Brand = {
  /** The one accent: primary actions and focus. */
  accent: string;
  /** Text and icons on the accent. */
  onAccent: string;
};

/** Night Drive's own cyan, used by the unbranded app. */
export const DefaultBrand: Brand = {
  accent: '#3DD9EB',
  onAccent: '#061317',
};

export type ColorScheme = keyof typeof Colors;
type BaseColors = (typeof Colors)[ColorScheme];
export type Theme = { [K in keyof BaseColors]: BaseColors[K] extends string ? string : number } & Brand;
/** Every colour token (the string-valued ones). */
export type ThemeColor = { [K in keyof Theme]: Theme[K] extends string ? K : never }[keyof Theme];

/** Font family names as registered with expo-font. Weight is chosen by family, not `fontWeight`. */
export const Fonts = {
  body: 'Barlow_400Regular',
  bodyMedium: 'Barlow_500Medium',
  bodySemiBold: 'Barlow_600SemiBold',
  displayBold: 'BarlowSemiCondensed_700Bold',
  display: 'BarlowSemiCondensed_800ExtraBold',
} as const;

/** Passed to `useFonts` once at startup. */
export const FontAssets = {
  [Fonts.body]: Barlow_400Regular,
  [Fonts.bodyMedium]: Barlow_500Medium,
  [Fonts.bodySemiBold]: Barlow_600SemiBold,
  [Fonts.displayBold]: BarlowSemiCondensed_700Bold,
  [Fonts.display]: BarlowSemiCondensed_800ExtraBold,
};

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
  /** Horizontal screen gutter. */
  gutter: 20,
} as const;

export const Radius = {
  /** Text fields, segments. */
  field: 14,
  /** Cards and list groups. */
  card: 18,
  /** Vehicle cards. */
  hero: 24,
  pill: 999,
} as const;

export const Control = {
  /** Minimum tappable size. */
  touch: 44,
  /** Fields and standard buttons. */
  height: 52,
  /** Primary call to action. */
  heightLarge: 56,
} as const;

/** The floating tab bar's height and its distance from the bottom safe area. */
export const TabBar = {
  height: 64,
  margin: 12,
} as const;

export const MaxContentWidth = 800;
