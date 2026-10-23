/**
 * Runtime brand of a shop's app: the accent colours and logo a shop sets in
 * its portal, layered over the fixed Night Drive palette without a rebuild.
 *
 * The brand overrides only the accent role (`accent`, `onAccent`). Every other
 * token stays Night Drive so status colours and surfaces read the same in
 * every shop's app.
 */

import { contrastRatio, MIN_TEXT_CONTRAST, pickOnAccent, type TenantConfig } from './tenant';

/** The `brand` JSON a shop edits in the portal. Every field is optional. */
export type TenantBrand = {
  accent?: string;
  onAccent?: string;
  logoUrl?: string;
};

/** One opening window; `day` 0 is Sunday, times are `HH:MM` local to the shop. */
export type OpeningHours = { day: number; opens: string; closes: string };

/** A row of the public `tenant_profiles` view in Supabase. */
export type TenantProfile = {
  slug: string;
  name: string;
  brand: TenantBrand;
  phone: string | null;
  email: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  hours: OpeningHours[] | null;
  booking_url: string | null;
  website_url: string | null;
  updated_at: string;
};

/** The tokens a brand may override. */
export type BrandOverlay = {
  accent: string;
  onAccent: string;
};

const HEX = /^#[0-9A-Fa-f]{6}$/;
const HTTPS_URL = /^https:\/\/\S+$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The overlay for this build: the shop's live accent when it has a usable
 * one, otherwise the accent baked into `tenant.json`. `onAccent` is the shop's
 * when it reaches 4.5:1 on the accent, otherwise computed with `pickOnAccent`.
 */
export function resolveBrand(config: TenantConfig, profile: TenantProfile | null): BrandOverlay {
  const live = profile?.brand.accent;
  if (live && HEX.test(live)) return { accent: live, onAccent: readableOn(live, profile?.brand.onAccent) };
  return { accent: config.accent, onAccent: readableOn(config.accent, config.onAccent) };
}

/** Night Drive's colour tokens with the brand's accent role laid over them. */
export function applyBrand<T extends object>(base: T, overlay: BrandOverlay): Omit<T, keyof BrandOverlay> & BrandOverlay {
  return { ...base, accent: overlay.accent, onAccent: overlay.onAccent };
}

/**
 * Reads a `tenant_profiles` row from the network or the local cache. Returns
 * null when the required fields are missing; drops brand fields that are not
 * valid colours or https URLs so a bad portal edit can't break the app.
 */
export function parseTenantProfile(value: unknown): TenantProfile | null {
  if (!isRecord(value)) return null;
  const { slug, name, updated_at: updatedAt } = value;
  if (typeof slug !== 'string' || typeof name !== 'string' || typeof updatedAt !== 'string') return null;

  const brandInput = isRecord(value.brand) ? value.brand : {};
  const brand: TenantBrand = {};
  if (isHex(brandInput.accent)) brand.accent = brandInput.accent;
  if (isHex(brandInput.onAccent)) brand.onAccent = brandInput.onAccent;
  if (typeof brandInput.logoUrl === 'string' && HTTPS_URL.test(brandInput.logoUrl)) brand.logoUrl = brandInput.logoUrl;

  return {
    slug,
    name,
    brand,
    phone: stringOrNull(value.phone),
    email: stringOrNull(value.email),
    address: stringOrNull(value.address),
    latitude: numberOrNull(value.latitude),
    longitude: numberOrNull(value.longitude),
    hours: Array.isArray(value.hours) ? value.hours.filter(isOpeningHours) : null,
    booking_url: urlOrNull(value.booking_url),
    website_url: urlOrNull(value.website_url),
    updated_at: updatedAt,
  };
}

function readableOn(accent: string, preferred: string | undefined): string {
  if (preferred && HEX.test(preferred) && contrastRatio(accent, preferred) >= MIN_TEXT_CONTRAST) return preferred;
  return pickOnAccent(accent);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHex(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function urlOrNull(value: unknown): string | null {
  return typeof value === 'string' && HTTPS_URL.test(value) ? value : null;
}

function isOpeningHours(value: unknown): value is OpeningHours {
  return (
    isRecord(value) &&
    Number.isInteger(value.day) &&
    (value.day as number) >= 0 &&
    (value.day as number) <= 6 &&
    typeof value.opens === 'string' &&
    TIME.test(value.opens) &&
    typeof value.closes === 'string' &&
    TIME.test(value.closes)
  );
}
