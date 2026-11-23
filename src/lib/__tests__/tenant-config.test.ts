const demo = {
  slug: 'demo-shop',
  appName: 'Demo Auto Service',
  iosBundleId: 'ca.carmaintenance.demoshop',
  androidPackage: 'ca.carmaintenance.demoshop',
  scheme: 'demoshop',
  accent: '#FF8A3D',
  splashBackground: '#1A1D21',
  easUpdateChannel: 'demo-shop',
};

function load(tenant: unknown) {
  jest.resetModules();
  jest.doMock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { tenant } } } }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../tenant-config') as typeof import('../tenant-config');
}

describe('tenant-config', () => {
  it('reads the tenant embedded by app.config.ts', () => {
    const { bundledTenant, isBrandedBuild } = load(demo);
    expect(bundledTenant).toEqual(demo);
    expect(isBrandedBuild).toBe(true);
  });

  it('falls back to the default tenant when none is embedded', () => {
    const { bundledTenant, isBrandedBuild } = load(undefined);
    expect(bundledTenant.slug).toBe('default');
    expect(bundledTenant.appName).toBe('Car Maintenance');
    expect(isBrandedBuild).toBe(false);
  });

  it('falls back to the default tenant when the embedded one is invalid', () => {
    expect(load({ ...demo, accent: 'orange' }).bundledTenant.slug).toBe('default');
  });
});
