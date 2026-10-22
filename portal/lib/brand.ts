import { isHexColour, pickOnAccent } from './contrast';
import { type OpeningHours, parseHours } from './hours';

/** `tenants.brand`: `{ accent?, onAccent?, logoUrl? }`, other keys kept as-is. */
export type Brand = { accent?: string; onAccent?: string; logoUrl?: string; [key: string]: unknown };

/** The `tenants` columns the Brand page edits. */
export type TenantBrandUpdate = {
  name: string;
  brand: Brand;
  phone: string | null;
  email: string | null;
  address: string | null;
  hours: OpeningHours[] | null;
  booking_url: string | null;
  website_url: string | null;
};

export type BrandField = 'name' | 'accent' | 'logoUrl' | 'email' | 'bookingUrl' | 'websiteUrl' | 'hours';

export type BrandError =
  | 'nameRequired'
  | 'accentInvalid'
  | 'accentNoContrast'
  | 'logoInvalid'
  | 'emailInvalid'
  | 'urlInvalid'
  | 'hoursInvalid';

export type BrandParse =
  | { ok: true; update: TenantBrandUpdate }
  | { ok: false; errors: Partial<Record<BrandField, BrandError>> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates the Brand form and builds the `tenants` update. `logoPrefix` is
 * the public URL of the tenant's folder in the `tenant-assets` bucket; a logo
 * must live there. `onAccent` is recomputed from the accent so the app never
 * reads a stale text colour.
 */
export function parseBrandForm(form: FormData, existingBrand: Brand, logoPrefix: string): BrandParse {
  const text = (key: string) => String(form.get(key) ?? '').trim();
  const optional = (key: string) => text(key) || null;
  const errors: Partial<Record<BrandField, BrandError>> = {};

  const name = text('name');
  if (!name) errors.name = 'nameRequired';

  const accent = text('accent').toUpperCase();
  const onAccent = isHexColour(accent) ? pickOnAccent(accent) : null;
  if (!isHexColour(accent)) errors.accent = 'accentInvalid';
  else if (!onAccent) errors.accent = 'accentNoContrast';

  const logoUrl = text('logoUrl');
  if (logoUrl && !(logoUrl.startsWith(logoPrefix) && logoUrl.length > logoPrefix.length)) {
    errors.logoUrl = 'logoInvalid';
  }

  const email = optional('email');
  if (email && !EMAIL.test(email)) errors.email = 'emailInvalid';

  const bookingUrl = optional('bookingUrl');
  if (bookingUrl && !isWebUrl(bookingUrl)) errors.bookingUrl = 'urlInvalid';
  const websiteUrl = optional('websiteUrl');
  if (websiteUrl && !isWebUrl(websiteUrl)) errors.websiteUrl = 'urlInvalid';

  const hours = parseHours(form);
  if (!hours.ok) errors.hours = 'hoursInvalid';

  if (Object.keys(errors).length > 0 || !hours.ok || !onAccent) return { ok: false, errors };

  const brand: Brand = { ...existingBrand, accent, onAccent };
  if (logoUrl) brand.logoUrl = logoUrl;
  else delete brand.logoUrl;

  return {
    ok: true,
    update: {
      name,
      brand,
      phone: optional('phone'),
      email,
      address: optional('address'),
      hours: hours.hours,
      booking_url: bookingUrl,
      website_url: websiteUrl,
    },
  };
}

export function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.includes('.');
  } catch {
    return false;
  }
}

/** Public URL prefix for a tenant's files in the `tenant-assets` bucket. */
export function tenantAssetsPrefix(supabaseUrl: string, tenantId: string): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/tenant-assets/${tenantId}/`;
}
