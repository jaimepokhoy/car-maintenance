import { migrate, MIGRATIONS } from '../migrations';
import {
  deleteServiceRecord,
  insertServiceRecord,
  listAllServiceRecords,
  listServiceRecords,
  logService,
} from '../service-records';
import type { Db } from '../types';
import {
  deleteVehicle,
  getVehicle,
  insertVehicle,
  listVehicles,
  updateOdometer,
  updateVehicleDetails,
} from '../vehicles';
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

  it('stores the optional details', async () => {
    const details = { trim: 'EX', licencePlate: 'CKMT 123', tireSize: '215/55R16' };
    await insertVehicle(db, 'v1', { ...civic, ...details }, now, '2026-10-11');
    expect(await getVehicle(db, 'v1')).toMatchObject(details);
  });

  it('edits details without touching the odometer or tire set', async () => {
    await insertVehicle(db, 'v1', civic, now, '2026-10-11');
    await updateOdometer(db, 'v1', 86_200, now, '2026-11-01');
    const { odometerKm: _, ...rest } = civic;
    await updateVehicleDetails(
      db,
      'v1',
      { ...rest, nickname: 'Commuter', trim: 'Sport', vin: '1M8GDM9AXKP042788', licencePlate: 'ABC 123' },
      new Date('2026-11-02T00:00:00Z'),
    );
    expect(await getVehicle(db, 'v1')).toMatchObject({
      nickname: 'Commuter',
      trim: 'Sport',
      vin: '1M8GDM9AXKP042788',
      licencePlate: 'ABC 123',
      tireSize: undefined,
      odometerKm: 86_200,
      odometerUpdatedOn: '2026-11-01',
    });
    await updateVehicleDetails(db, 'v1', { ...rest, nickname: 'Commuter' }, now);
    expect(await getVehicle(db, 'v1')).toMatchObject({ trim: undefined, licencePlate: undefined });
  });

  it('deletes the service history with the vehicle', async () => {
    await insertVehicle(db, 'v1', civic, now, '2026-10-11');
    await insertVehicle(db, 'v2', civic, now, '2026-10-11');
    const base = { itemIds: ['oil_change' as const], odometerKm: 80_000, performedOn: '2026-01-10' };
    await insertServiceRecord(db, { ...base, id: 's1', vehicleId: 'v1' }, now);
    await insertServiceRecord(db, { ...base, id: 's2', vehicleId: 'v2' }, now);
    await deleteVehicle(db, 'v1', now);
    expect((await listAllServiceRecords(db)).map((r) => r.id)).toEqual(['s2']);
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
  it('lists live records across every vehicle', async () => {
    await insertVehicle(db, 'v1', civic, now, '2026-10-11');
    await insertVehicle(db, 'v2', { ...civic, nickname: 'Winter beater' }, now, '2026-10-11');
    const base = { itemIds: ['oil_change' as const], odometerKm: 80_000 };
    await insertServiceRecord(db, { ...base, id: 's1', vehicleId: 'v1', performedOn: '2026-01-10' }, now);
    await insertServiceRecord(db, { ...base, id: 's2', vehicleId: 'v2', performedOn: '2026-03-10' }, now);
    await insertServiceRecord(db, { ...base, id: 's3', vehicleId: 'v2', performedOn: '2026-05-10' }, now);
    await deleteServiceRecord(db, 's3', now);
    expect((await listAllServiceRecords(db)).map((r) => r.id)).toEqual(['s2', 's1']);
  });

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

describe('logService', () => {
  beforeEach(async () => {
    await insertVehicle(db, 'v1', civic, now, '2026-10-01');
  });

  it('moves the odometer forward when the service reading is higher', async () => {
    await logService(
      db,
      { id: 's1', vehicleId: 'v1', itemIds: ['oil_change'], performedOn: '2026-10-11', odometerKm: 85_600 },
      now,
    );
    expect(await getVehicle(db, 'v1')).toMatchObject({ odometerKm: 85_600, odometerUpdatedOn: '2026-10-11' });
    expect(await listServiceRecords(db, 'v1')).toHaveLength(1);
  });

  it('leaves the odometer alone for an older service', async () => {
    await logService(
      db,
      { id: 's1', vehicleId: 'v1', itemIds: ['oil_change'], performedOn: '2026-01-11', odometerKm: 70_000 },
      now,
    );
    expect(await getVehicle(db, 'v1')).toMatchObject({ odometerKm: 85_000, odometerUpdatedOn: '2026-10-01' });
  });

  it('saves nothing if the insert fails', async () => {
    const record = { id: 's1', vehicleId: 'v1', itemIds: ['oil_change' as const], performedOn: '2026-10-11', odometerKm: 90_000 };
    await logService(db, record, now);
    await expect(logService(db, { ...record, odometerKm: 95_000 }, now)).rejects.toThrow();
    expect(await getVehicle(db, 'v1')).toMatchObject({ odometerKm: 90_000 });
  });

  it('hides deleted service records', async () => {
    await logService(
      db,
      { id: 's1', vehicleId: 'v1', itemIds: ['oil_change'], performedOn: '2026-10-11', odometerKm: 85_600 },
      now,
    );
    await deleteServiceRecord(db, 's1', now);
    expect(await listServiceRecords(db, 'v1')).toEqual([]);
  });
});
