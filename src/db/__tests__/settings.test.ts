import { createMemoryDb } from '@/test-utils/memory-db';

import { migrate } from '../migrations';
import { getPreferences, setPreference } from '../settings';
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
