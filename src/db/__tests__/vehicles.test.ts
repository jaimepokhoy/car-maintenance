import { migrate, MIGRATIONS } from '../migrations';
import { insertServiceRecord, listServiceRecords } from '../service-records';
import type { Db } from '../types';
import { deleteVehicle, getVehicle, insertVehicle, listVehicles, updateOdometer } from '../vehicles';
import { createMemoryDb } from '@/test-utils/memory-db';

const now = new Date('2026-10-11T12:00:00Z');
const civic = {
  nickname: 'Daily driver',
  year: 2019,
  make: 'Honda',
  model: 'Civic',
  powertrain: 'gas' as const,
  odometerKm: 85_000,
};

let db: Db;

beforeEach(async () => {
  db = createMemoryDb();
  await migrate(db);
});

describe('migrate', () => {
  it('records the schema version and is safe to run again', async () => {
    await migrate(db);
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(row?.user_version).toBe(MIGRATIONS.length);
  });
});

describe('vehicles', () => {
  it('inserts and reads back a vehicle', async () => {
    const saved = await insertVehicle(db, 'v1', civic, now, '2026-10-11');
    expect(await getVehicle(db, 'v1')).toEqual(saved);
    expect(saved).toMatchObject({ id: 'v1', odometerUpdatedOn: '2026-10-11' });
  });

  it('lists vehicles in the order they were added', async () => {
    await insertVehicle(db, 'a', civic, now, '2026-10-11');
    await insertVehicle(db, 'b', { ...civic, nickname: 'EV' }, new Date('2026-10-12T00:00:00Z'), '2026-10-12');
    expect((await listVehicles(db)).map((v) => v.id)).toEqual(['a', 'b']);
  });

  it('updates the odometer and its date', async () => {
    await insertVehicle(db, 'v1', civic, now, '2026-10-11');
    await updateOdometer(db, 'v1', 86_200, now, '2026-11-01');
    expect(await getVehicle(db, 'v1')).toMatchObject({ odometerKm: 86_200, odometerUpdatedOn: '2026-11-01' });
  });

  it('hides deleted vehicles but keeps the row for sync', async () => {
    await insertVehicle(db, 'v1', civic, now, '2026-10-11');
    await deleteVehicle(db, 'v1', now);
    expect(await listVehicles(db)).toEqual([]);
    expect(await getVehicle(db, 'v1')).toBeNull();
    const row = await db.getFirstAsync<{ deleted_at: string; dirty: number }>(
      'SELECT deleted_at, dirty FROM vehicles WHERE id = ?',
      'v1',
    );
    expect(row).toEqual({ deleted_at: now.toISOString(), dirty: 1 });
  });
});

describe('service records', () => {
  it('round-trips records newest first', async () => {
    await insertVehicle(db, 'v1', civic, now, '2026-10-11');
    await insertServiceRecord(
      db,
      { id: 's1', vehicleId: 'v1', itemIds: ['oil_change'], performedOn: '2026-01-10', odometerKm: 80_000 },
      now,
    );
    await insertServiceRecord(
      db,
      {
        id: 's2',
        vehicleId: 'v1',
        itemIds: ['oil_change', 'tire_rotation'],
        performedOn: '2026-07-02',
        odometerKm: 84_000,
        costCents: 12_999,
        currency: 'CAD',
      },
      now,
    );
    const records = await listServiceRecords(db, 'v1');
    expect(records.map((r) => r.id)).toEqual(['s2', 's1']);
    expect(records[0]).toEqual({
      id: 's2',
      vehicleId: 'v1',
      itemIds: ['oil_change', 'tire_rotation'],
      performedOn: '2026-07-02',
      odometerKm: 84_000,
      costCents: 12_999,
      currency: 'CAD',
      shopId: undefined,
      notes: undefined,
    });
  });

  it('rejects records for a vehicle that does not exist', async () => {
    await expect(
      insertServiceRecord(
        db,
        { id: 's1', vehicleId: 'nope', itemIds: ['oil_change'], performedOn: '2026-01-10', odometerKm: 1 },
        now,
      ),
    ).rejects.toThrow(/FOREIGN KEY/);
  });
});
