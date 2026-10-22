import { describe, expect, it } from 'vitest';

import { isWebUrl, parseBrandForm, tenantAssetsPrefix } from '../brand';

const prefix = tenantAssetsPrefix('https://abc.supabase.co/', 'tenant-1');

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

const valid = {
  name: '  Maple Auto  ',
  accent: '#0b3d91',
  logoUrl: `${prefix}logo-1.png`,
  phone: '416-555-0100',
  email: 'service@maple.ca',
  address: '1 Queen St W, Toronto, ON',
  bookingUrl: 'https://maple.ca/book',
  websiteUrl: '',
  'hours-1-open': 'on',
  'hours-1-opens': '08:00',
  'hours-1-closes': '17:00',
};

describe('parseBrandForm', () => {
  it('builds the tenants update', () => {
    const result = parseBrandForm(form(valid), { accent: '#3DD9EB', extra: 1 }, prefix);
    expect(result).toEqual({
      ok: true,
      update: {
        name: 'Maple Auto',
        brand: { accent: '#0B3D91', onAccent: '#FFFFFF', logoUrl: `${prefix}logo-1.png`, extra: 1 },
        phone: '416-555-0100',
        email: 'service@maple.ca',
        address: '1 Queen St W, Toronto, ON',
        hours: [{ day: 1, opens: '08:00', closes: '17:00' }],
        booking_url: 'https://maple.ca/book',
        website_url: null,
      },
    });
  });

  it('drops a removed logo', () => {
    const result = parseBrandForm(form({ ...valid, logoUrl: '' }), { logoUrl: `${prefix}old.png` }, prefix);
    expect(result.ok && result.update.brand).toEqual({ accent: '#0B3D91', onAccent: '#FFFFFF' });
  });

  it('reports each invalid field', () => {
    const result = parseBrandForm(
      form({
        name: ' ',
        accent: '#12345',
        logoUrl: 'https://evil.example/logo.png',
        email: 'nope',
        bookingUrl: 'javascript:alert(1)',
        websiteUrl: 'maple',
        'hours-0-open': 'on',
      }),
      {},
      prefix,
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        name: 'nameRequired',
        accent: 'accentInvalid',
        logoUrl: 'logoInvalid',
        email: 'emailInvalid',
        bookingUrl: 'urlInvalid',
        websiteUrl: 'urlInvalid',
        hours: 'hoursInvalid',
      },
    });
  });

  it('rejects a malformed accent and a logo in another tenant folder', () => {
    const other = tenantAssetsPrefix('https://abc.supabase.co', 'tenant-2');
    const result = parseBrandForm(form({ ...valid, accent: 'blue', logoUrl: `${other}logo.png` }), {}, prefix);
    expect(result).toEqual({ ok: false, errors: { accent: 'accentInvalid', logoUrl: 'logoInvalid' } });
  });

  it('rejects a logo URL that climbs out of the tenant folder', () => {
    for (const logoUrl of [`${prefix}../tenant-2/logo.png`, `${prefix}sub/logo.png`, `${prefix}..`, `${prefix}a.png?x`]) {
      expect(parseBrandForm(form({ ...valid, logoUrl }), {}, prefix)).toEqual({
        ok: false,
        errors: { logoUrl: 'logoInvalid' },
      });
    }
  });

  it('saves a mid-tone accent with black text, like the app', () => {
    const result = parseBrandForm(form({ ...valid, accent: '#7a7a7a' }), {}, prefix);
    expect(result.ok && result.update.brand).toMatchObject({ accent: '#7A7A7A', onAccent: '#000000' });
  });
});

describe('isWebUrl', () => {
  it('accepts http and https with a domain', () => {
    expect(isWebUrl('https://maple.ca')).toBe(true);
    expect(isWebUrl('http://maple.ca/book?x=1')).toBe(true);
    expect(isWebUrl('ftp://maple.ca')).toBe(false);
    expect(isWebUrl('https://localhost')).toBe(false);
  });
});

describe('tenantAssetsPrefix', () => {
  it('points at the tenant folder of the public bucket', () => {
    expect(prefix).toBe('https://abc.supabase.co/storage/v1/object/public/tenant-assets/tenant-1/');
  });
});
