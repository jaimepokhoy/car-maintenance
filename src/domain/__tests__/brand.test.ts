import { applyBrand, parseTenantProfile, resolveBrand, type TenantProfile } from '../brand';
import { contrastRatio, type TenantConfig } from '../tenant';

const defaultConfig: TenantConfig = {
  slug: 'default',
  appName: 'Car Maintenance',
  scheme: 'carmaintenance',
  accent: '#3DD9EB',
  onAccent: '#061317',
  splashBackground: '#208AEF',
  easUpdateChannel: 'default',
};

const shopConfig: TenantConfig = {
  slug: 'demo-shop',
  appName: 'Demo Auto Service',
  iosBundleId: 'ca.carmaintenance.demoshop',
  androidPackage: 'ca.carmaintenance.demoshop',
  scheme: 'demoshop',
  accent: '#FF8A3D',
  splashBackground: '#1A1D21',
  easUpdateChannel: 'demo-shop',
};

function profile(brand: TenantProfile['brand']): TenantProfile {
  return {
    slug: 'demo-shop',
    name: 'Demo Auto Service',
    brand,
    phone: null,
    email: null,
    address: null,
    latitude: null,
    longitude: null,
    hours: null,
    booking_url: null,
    website_url: null,
    updated_at: '2026-10-20T12:00:00Z',
  };
}

describe('resolveBrand', () => {
  it('keeps the Night Drive cyan for the default build', () => {
    expect(resolveBrand(defaultConfig, null)).toEqual({ accent: '#3DD9EB', onAccent: '#061317' });
  });

  it('uses the bundled accent and computes a readable onAccent when the shop gave none', () => {
    const brand = resolveBrand(shopConfig, null);
    expect(brand.accent).toBe('#FF8A3D');
    expect(contrastRatio(brand.accent, brand.onAccent)).toBeGreaterThanOrEqual(4.5);
  });

  it('prefers the live accent from the shop profile', () => {
    expect(resolveBrand(shopConfig, profile({ accent: '#1D4ED8' }))).toEqual({
      accent: '#1D4ED8',
      onAccent: '#FFFFFF',
    });
  });

  it("keeps the shop's onAccent when it is readable and replaces it when it is not", () => {
    expect(resolveBrand(shopConfig, profile({ accent: '#1D4ED8', onAccent: '#F0F0F0' })).onAccent).toBe('#F0F0F0');
    expect(resolveBrand(shopConfig, profile({ accent: '#1D4ED8', onAccent: '#1E40AF' })).onAccent).toBe('#FFFFFF');
  });

  it('keeps a mid-tone live accent and still gives it readable text', () => {
    // Neither near-black nor white reaches 4.5:1 on this grey.
    const brand = resolveBrand(shopConfig, profile({ accent: '#777777' }));
    expect(brand.accent).toBe('#777777');
    expect(contrastRatio(brand.accent, brand.onAccent)).toBeGreaterThanOrEqual(4.5);
  });

  it('falls back to the bundled accent when the profile has no brand colour', () => {
    expect(resolveBrand(shopConfig, profile({ logoUrl: 'https://example.com/logo.png' })).accent).toBe('#FF8A3D');
  });
});

describe('applyBrand', () => {
  it('overrides only the accent role', () => {
    const base = { accent: '#3DD9EB', onAccent: '#061317', background: '#0A0C0F', glow: 0.22 };
    expect(applyBrand(base, { accent: '#FF8A3D', onAccent: '#061317' })).toEqual({
      accent: '#FF8A3D',
      onAccent: '#061317',
      background: '#0A0C0F',
      glow: 0.22,
    });
  });

  it('adds the accent role to a base that has none', () => {
    expect(applyBrand({ background: '#0A0C0F' }, { accent: '#FF8A3D', onAccent: '#061317' })).toEqual({
      background: '#0A0C0F',
      accent: '#FF8A3D',
      onAccent: '#061317',
    });
  });

  it('ignores extra keys on the overlay', () => {
    const base = { accent: '#3DD9EB', onAccent: '#061317', text: '#F2F4F5' };
    const overlay = { accent: '#FF8A3D', onAccent: '#061317', text: '#000000' };
    expect(applyBrand(base, overlay).text).toBe('#F2F4F5');
  });
});

describe('parseTenantProfile', () => {
  const row = {
    slug: 'demo-shop',
    name: 'Demo Auto Service',
    brand: { accent: '#FF8A3D', logoUrl: 'https://cdn.example.com/logo.png' },
    phone: '514-555-0100',
    email: null,
    address: '1 Rue Example, Montréal',
    latitude: 45.5,
    longitude: -73.57,
    hours: [{ day: 1, opens: '08:00', closes: '17:00' }],
    booking_url: 'https://book.example.com',
    website_url: null,
    updated_at: '2026-10-20T12:00:00Z',
  };

  it('reads a full row', () => {
    expect(parseTenantProfile(row)).toEqual(row);
  });

  it('keeps the shop id the live view returns, and only a non-empty string', () => {
    const id = 'aaaaaaaa-0000-4000-8000-000000000000';
    expect(parseTenantProfile({ ...row, id })).toEqual({ ...row, id });
    expect(parseTenantProfile({ ...row, id: '' })).toEqual(row);
    expect(parseTenantProfile({ ...row, id: 7 })).toEqual(row);
  });

  it('rejects rows without the required fields', () => {
    expect(parseTenantProfile(null)).toBeNull();
    expect(parseTenantProfile([])).toBeNull();
    expect(parseTenantProfile({ ...row, slug: undefined })).toBeNull();
    expect(parseTenantProfile({ ...row, name: 3 })).toBeNull();
  });

  it('drops brand fields that are not colours or https URLs', () => {
    const parsed = parseTenantProfile({
      ...row,
      brand: { accent: 'orange', onAccent: '#FFF', logoUrl: 'http://insecure.example.com/logo.png' },
    });
    expect(parsed?.brand).toEqual({});
  });

  it('treats a missing brand as empty and bad optional fields as null', () => {
    const parsed = parseTenantProfile({
      ...row,
      brand: 'nope',
      phone: '',
      latitude: 'north',
      booking_url: 'javascript:alert(1)',
      hours: [{ day: 7, opens: '08:00', closes: '17:00' }, { day: 2, opens: '9am', closes: '17:00' }, row.hours[0]],
    });
    expect(parsed).toMatchObject({ brand: {}, phone: null, latitude: null, booking_url: null, hours: row.hours });
  });
});
