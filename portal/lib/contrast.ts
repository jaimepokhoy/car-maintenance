/**
 * Accent contrast checks for the Brand page.
 *
 * Same formula and text colours as `contrastRatio` / `pickOnAccent` in the
 * app's `src/domain/tenant.ts`, so the portal stores the same `onAccent` the
 * app would compute. Switch to importing that module once both stacks are merged.
 */

/** WCAG AA for normal text. */
export const MIN_TEXT_CONTRAST = 4.5;

export const DARK_ON_ACCENT = '#061317';
export const LIGHT_ON_ACCENT = '#FFFFFF';
/** Black reaches 4.5:1 on every colour where white does not. */
export const BLACK_ON_ACCENT = '#000000';

const HEX = /^#[0-9A-Fa-f]{6}$/;

export function isHexColour(value: string): boolean {
  return HEX.test(value);
}

/** WCAG contrast ratio between two `#RRGGBB` colours, from 1 to 21. */
export function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * The text colour for labels on the accent, always at least 4.5:1: Night
 * Drive's near-black ink or white, whichever reads better, and pure black for
 * the few mid-tone accents where neither passes.
 */
export function pickOnAccent(accentHex: string): string {
  const dark = contrastRatio(accentHex, DARK_ON_ACCENT);
  const light = contrastRatio(accentHex, LIGHT_ON_ACCENT);
  const best = dark >= light ? { hex: DARK_ON_ACCENT, ratio: dark } : { hex: LIGHT_ON_ACCENT, ratio: light };
  return best.ratio >= MIN_TEXT_CONTRAST ? best.hex : BLACK_ON_ACCENT;
}

function relativeLuminance(hex: string): number {
  if (!HEX.test(hex)) throw new Error(`Not a #RRGGBB colour: ${hex}`);
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}
