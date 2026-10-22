import fs from 'node:fs';
import path from 'node:path';

import { contrastRatio, isTenantSlug, pickOnAccent, validateTenantConfig } from '../tenant';

const shop = {
  slug: 'demo-shop',
  appName: 'Demo Auto Service',
  iosBundleId: 'ca.carmaintenance.demoshop',
  androidPackage: 'ca.carmaintenance.demoshop',
  scheme: 'demoshop',
  accent: '#FF8A3D',
  splashBackground: '#1A1D21',
  easUpdateChannel: 'demo-shop',
};

function errorsFor(value: unknown): string[] {
  const result = validateTenantConfig(value);
  return result.ok ? [] : result.errors;
}

describe('contrastRatio', () => {
  it('spans 1:1 to 21:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21);
    expect(contrastRatio('#3DD9EB', '#3DD9EB')).toBe(1);
  });

  it('is symmetric and matches the WCAG reference', () => {
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
    expect(contrastRatio('#FFFFFF', '#767676')).toBe(contrastRatio('#767676', '#FFFFFF'));
  });

  it('rejects colours that are not #RRGGBB', () => {
    expect(() => contrastRatio('#FFF', '#000000')).toThrow();
  });
});

describe('pickOnAccent', () => {
  it('uses Night Drive ink on light accents and white on dark ones', () => {
    expect(pickOnAccent('#3DD9EB')).toBe('#061317');
    expect(pickOnAccent('#0B3D91')).toBe('#FFFFFF');
  });

  it('always returns a colour that passes 4.5:1', () => {
    for (const accent of ['#FF8A3D', '#D32F2F', '#2E7D32', '#FFEB3B', '#6A1B9A']) {
      const onAccent = pickOnAccent(accent);
      expect(onAccent).not.toBeNull();
      expect(contrastRatio(accent, onAccent!)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('isTenantSlug', () => {
  it('allows lowercase slugs and rejects paths', () => {
    expect(isTenantSlug('demo-shop')).toBe(true);
    expect(isTenantSlug('../demo')).toBe(false);
    expect(isTenantSlug('Demo')).toBe(false);
    expect(isTenantSlug('demo--shop')).toBe(false);
  });
});

describe('validateTenantConfig', () => {
  it('accepts a complete shop config', () => {
    expect(validateTenantConfig(shop)).toEqual({ ok: true, config: shop });
  });

  it('lets only the default tenant leave out store ids', () => {
    const { iosBundleId: _ios, androidPackage: _android, ...withoutIds } = shop;
    expect(validateTenantConfig({ ...withoutIds, slug: 'default' }).ok).toBe(true);
    expect(errorsFor(withoutIds)).toEqual(['iosBundleId is required', 'androidPackage is required']);
  });

  it('reports every bad field', () => {
    expect(
      errorsFor({
        ...shop,
        slug: 'Demo Shop',
        appName: '',
        iosBundleId: 'demoshop',
        androidPackage: 'ca.1demo',
        scheme: 'Demo Shop',
        accent: 'orange',
        splashBackground: '#12345',
        easUpdateChannel: 'Demo',
      }),
    ).toHaveLength(8);
  });

  it('rejects unknown fields so typos do not slip through', () => {
    expect(errorsFor({ ...shop, acent: '#FF8A3D' })).toEqual(['unknown field acent']);
  });

  it('caps the app name at the App Store limit', () => {
    expect(errorsFor({ ...shop, appName: 'A'.repeat(31) })).toEqual(['appName must be at most 30 characters']);
  });

  it('rejects an onAccent that is hard to read on the accent', () => {
    expect(errorsFor({ ...shop, onAccent: '#FFFFFF' })[0]).toMatch(/^onAccent contrast on accent is 2\.\d\d:1/);
    expect(validateTenantConfig({ ...shop, onAccent: '#061317' }).ok).toBe(true);
  });

  it('rejects non-objects', () => {
    expect(errorsFor(null)).toEqual(['tenant config must be an object']);
    expect(errorsFor([])).toEqual(['tenant config must be an object']);
  });

  it('accepts every tenant in the repo', () => {
    const root = path.join(__dirname, '../../../tenants');
    for (const slug of fs.readdirSync(root)) {
      const config = JSON.parse(fs.readFileSync(path.join(root, slug, 'tenant.json'), 'utf8'));
      expect({ slug, errors: errorsFor(config) }).toEqual({ slug, errors: [] });
      expect(config.slug).toBe(slug);
    }
  });
});
