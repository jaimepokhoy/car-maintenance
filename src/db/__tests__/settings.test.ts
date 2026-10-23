import { createMemoryDb } from '@/test-utils/memory-db';

import { migrate } from '../migrations';
import { getCachedTenantProfile, getPreferences, setCachedTenantProfile, setPreference } from '../settings';
import type { Db } from '../types';
import { getVehicle, insertVehicle, updateTireSet } from '../vehicles';

let db: Db;

beforeEach(async () => {
  db = createMemoryDb();
  await migrate(db);
});

describe('settings', () => {
  it('starts with defaults, saves, overwrites and clears', async () => {
    expect(await getPreferences(db)).toEqual({ language: 'system', distanceUnit: 'km', appearance: 'system' });
    await setPreference(db, 'distanceUnit', 'mi');
    await setPreference(db, 'province', 'QC');
    await setPreference(db, 'distanceUnit', 'km');
    await setPreference(db, 'appearance', 'dark');
    expect(await getPreferences(db)).toEqual({
      language: 'system',
      distanceUnit: 'km',
      appearance: 'dark',
      province: 'QC',
    });
    await setPreference(db, 'province', undefined);
    expect((await getPreferences(db)).province).toBeUndefined();
  });
});

describe('tenant profile cache', () => {
  const profile = {
    slug: 'demo-shop',
    name: 'Demo Auto Service',
    brand: { accent: '#FF8A3D' },
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

  it('saves, reads back and clears the profile without touching preferences', async () => {
    expect(await getCachedTenantProfile(db)).toBeNull();
    await setCachedTenantProfile(db, profile);
    expect(await getCachedTenantProfile(db)).toEqual(profile);
    expect(await getPreferences(db)).toEqual({ language: 'system', distanceUnit: 'km', appearance: 'system' });
    await setCachedTenantProfile(db, null);
    expect(await getCachedTenantProfile(db)).toBeNull();
  });

  it('ignores a corrupt cache entry', async () => {
    await db.runAsync("INSERT INTO settings (key, value) VALUES ('tenantProfile', '{not json')");
    expect(await getCachedTenantProfile(db)).toBeNull();
  });
});

describe('tire set', () => {
  it('is saved per vehicle', async () => {
    const now = new Date('2026-10-11T12:00:00Z');
    await insertVehicle(
      db,
      'v1',
      { nickname: 'Civic', year: 2019, make: 'Honda', model: 'Civic', powertrain: 'gas', odometerKm: 1 },
      now,
      '2026-10-11',
    );
    expect((await getVehicle(db, 'v1'))?.tireSet).toBeUndefined();
    await updateTireSet(db, 'v1', 'winter', now);
    expect((await getVehicle(db, 'v1'))?.tireSet).toBe('winter');
  });
});
