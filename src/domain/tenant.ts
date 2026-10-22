/**
 * Build-time identity of one shop's app (a "tenant"). Each tenant lives in
 * `tenants/<slug>/tenant.json`; `app.config.ts` validates it before a build so
 * a bad config fails fast instead of shipping a broken store app.
 *
 * The default tenant is today's unbranded consumer app. It has no store ids
 * yet, so the ids are optional for it and required for every shop.
 */
export type TenantConfig = {
  slug: string;
  appName: string;
  iosBundleId?: string;
  androidPackage?: string;
  scheme: string;
  /** Accent colour as `#RRGGBB`. */
  accent: string;
  /** Text colour on the accent; computed with `pickOnAccent` when missing. */
  onAccent?: string;
  splashBackground: string;
  easUpdateChannel: string;
};

export type TenantValidation = { ok: true; config: TenantConfig } | { ok: false; errors: string[] };

export const DEFAULT_TENANT_SLUG = 'default';

/** WCAG AA for normal text. */
export const MIN_TEXT_CONTRAST = 4.5;

const DARK_ON_ACCENT = '#061317';
const LIGHT_ON_ACCENT = '#FFFFFF';
/** Black reaches 4.5:1 on every colour where white does not. */
const BLACK_ON_ACCENT = '#000000';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HEX = /^#[0-9A-Fa-f]{6}$/;
const SCHEME = /^[a-z][a-z0-9+.-]*$/;
const IOS_BUNDLE_ID = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
const ANDROID_PACKAGE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
/** The App Store caps app names at 30 characters. */
const MAX_APP_NAME = 30;

const KEYS: readonly (keyof TenantConfig)[] = [
  'slug',
  'appName',
  'iosBundleId',
  'androidPackage',
  'scheme',
  'accent',
  'onAccent',
  'splashBackground',
  'easUpdateChannel',
];

export function isTenantSlug(value: string): boolean {
  return SLUG.test(value);
}

export function validateTenantConfig(value: unknown): TenantValidation {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, errors: ['tenant config must be an object'] };
  }
  const input = value as Record<string, unknown>;
  const errors: string[] = [];

  const check = (key: keyof TenantConfig, pattern: RegExp, message: string, required = true) => {
    const field = input[key];
    if (field === undefined) {
      if (required) errors.push(`${key} is required`);
    } else if (typeof field !== 'string' || !pattern.test(field)) {
      errors.push(`${key} ${message}`);
    }
  };

  for (const key of Object.keys(input)) {
    if (!(KEYS as readonly string[]).includes(key)) errors.push(`unknown field ${key}`);
  }

  check('slug', SLUG, 'must be lowercase letters, digits and single hyphens');
  const branded = input.slug !== DEFAULT_TENANT_SLUG;
  if (input.appName === undefined) {
    errors.push('appName is required');
  } else if (typeof input.appName !== 'string' || input.appName.trim() === '') {
    errors.push('appName must be a non-empty string');
  } else if (input.appName.length > MAX_APP_NAME) {
    errors.push(`appName must be at most ${MAX_APP_NAME} characters`);
  }
  check('iosBundleId', IOS_BUNDLE_ID, 'must be a reverse-DNS id like ca.shop.app', branded);
  check('androidPackage', ANDROID_PACKAGE, 'must be a Java package like ca.shop.app', branded);
  check('scheme', SCHEME, 'must start with a letter and use lowercase letters, digits, +, . or -');
  check('accent', HEX, 'must be a #RRGGBB colour');
  check('onAccent', HEX, 'must be a #RRGGBB colour', false);
  check('splashBackground', HEX, 'must be a #RRGGBB colour');
  check('easUpdateChannel', SLUG, 'must be lowercase letters, digits and single hyphens');

  if (errors.length === 0 && typeof input.onAccent === 'string') {
    const ratio = contrastRatio(input.accent as string, input.onAccent);
    if (ratio < MIN_TEXT_CONTRAST) {
      errors.push(`onAccent contrast on accent is ${ratio.toFixed(2)}:1, needs ${MIN_TEXT_CONTRAST}:1`);
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, config: input as TenantConfig };
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
