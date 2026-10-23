import { SYNC_KEYS, type SyncTable } from '@/domain';
import { createMemoryDb } from '@/test-utils/memory-db';

import { migrate } from '../migrations';
import { logService } from '../service-records';
import { getSetting } from '../settings';
import { getLastSyncedAt, pendingChanges, syncOnce, type RemoteRow, type SyncRemote } from '../sync';
import type { Db } from '../types';
import { deleteVehicle, getVehicle, insertVehicle, listVehicles, updateOdometer } from '../vehicles';

const ME = '11111111-1111-4111-8111-111111111111';
const CUSTOMER = '22222222-2222-4222-8222-222222222222';
const VEHICLE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TODAY = '2026-10-22';

/**
 * A stand-in for Supabase. Like the real tables, an update stamps
 * `updated_at` with the server's clock, and like staff RLS, `pull` can return
 * other users' rows when the caller doesn't filter them out.
 */
class FakeServer implements SyncRemote {
  tables = new Map<SyncTable, Map<string, RemoteRow>>();
  clock = Date.parse('2026-10-22T12:00:00Z');
  pulls: { table: SyncTable; since: string | null }[] = [];
  offline = false;
  reject: (row: RemoteRow) => boolean = () => false;

  rows(table: SyncTable): Map<string, RemoteRow> {
    if (!this.tables.has(table)) this.tables.set(table, new Map());
    return this.tables.get(table)!;
  }

  tick(ms = 1000): string {
    this.clock += ms;
    return new Date(this.clock).toISOString().replace('Z', '+00:00');
  }

  /** Writes a row as another device or a shop would. */
  put(table: SyncTable, row: RemoteRow) {
    this.rows(table).set(this.key(table, row), { ...row, updated_at: this.tick() });
  }

  get(table: SyncTable, id: string): RemoteRow | undefined {
    return this.rows(table).get(JSON.stringify([id]));
  }

  key(table: SyncTable, row: RemoteRow) {
    return JSON.stringify(SYNC_KEYS[table].map((column) => row[column]));
  }

  async pull(table: SyncTable, since: string | null) {
    if (this.offline) throw new TypeError('Network request failed');
    this.pulls.push({ table, since });
    return [...this.rows(table).values()].filter((row) => !since || Date.parse(String(row.updated_at)) >= Date.parse(since));
  }

  async push(table: SyncTable, rows: RemoteRow[]) {
    if (this.offline) throw new TypeError('Network request failed');
    if (rows.some(this.reject)) throw Object.assign(new Error('violates check constraint'), { code: '23514' });
    return rows.map((row) => {
      const key = this.key(table, row);
      // Like the update trigger, and the column default when an insert leaves `updated_at` out.
      const stored: RemoteRow = this.rows(table).has(key)
        ? { ...row, updated_at: this.tick() }
        : { updated_at: this.tick(), ...row };
      this.rows(table).set(key, stored);
      return Object.fromEntries([...SYNC_KEYS[table], 'updated_at'].map((column) => [column, stored[column]]));
    });
  }
}

function remoteVehicle(fields: Partial<RemoteRow> = {}): RemoteRow {
  return {
    id: VEHICLE,
    user_id: ME,
    nickname: 'Civic',
    year: 2018,
    make: 'Honda',
    model: 'Civic',
    trim_level: null,
    vin: null,
    powertrain: 'gas',
    odometer_km: 50000,
    odometer_updated_on: TODAY,
    tire_set: null,
    licence_plate: null,
    tire_size: null,
    created_at: '2026-10-01T10:00:00+00:00',
    deleted_at: null,
    ...fields,
  };
}

const vehicleInput = { nickname: 'Civic', year: 2018, make: 'Honda', model: 'Civic', powertrain: 'gas', odometerKm: 50000 } as const;

let db: Db;
let server: FakeServer;

beforeEach(async () => {
  db = createMemoryDb();
  await migrate(db);
  server = new FakeServer();
});

const sync = (at = '2026-10-22T13:00:00Z') => syncOnce(db, server, ME, new Date(at));
const dirtyCount = async (table: SyncTable) =>
  (await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE dirty = 1`))!.n;

describe('first sign-in', () => {
  it('uploads data saved before signing in, with the owner as user_id', async () => {
    await insertVehicle(db, VEHICLE, vehicleInput, new Date('2026-10-01T10:00:00Z'), '2026-10-01');
    await logService(
      db,
      { id: 'r1', vehicleId: VEHICLE, itemIds: ['oil_change', 'tire_rotation'], performedOn: '2026-10-05', odometerKm: 51000 },
      new Date('2026-10-05T10:00:00Z'),
    );

    const result = await sync();

    expect(result).toEqual({ pulled: 0, pushed: 2, rejected: 0 });
    expect(server.get('vehicles', VEHICLE)).toMatchObject({ user_id: ME, odometer_km: 51000, nickname: 'Civic' });
    expect(server.get('service_records', 'r1')).toMatchObject({
      user_id: ME,
      item_ids: ['oil_change', 'tire_rotation'],
      created_by_tenant_id: null,
    });
    expect(await dirtyCount('vehicles')).toBe(0);
    expect(await getLastSyncedAt(db)).toBe('2026-10-22T13:00:00.000Z');
  });

  it('uploads everything again when a different account signs in', async () => {
    await insertVehicle(db, VEHICLE, vehicleInput, new Date('2026-10-01T10:00:00Z'), '2026-10-01');
    await sync();
    await sync('2026-10-22T13:30:00Z');
    expect(await getSetting(db, 'sync.cursor.vehicles')).not.toBeNull();
    server.pulls = [];

    await syncOnce(db, server, CUSTOMER, new Date('2026-10-22T14:00:00Z'));

    expect(server.get('vehicles', VEHICLE)?.user_id).toBe(CUSTOMER);
    // The pull restarted from the beginning for the new account.
    expect(server.pulls.find((pull) => pull.table === 'vehicles')?.since).toBeNull();
  });
});

describe('push selection', () => {
  it('sends only rows changed since the last push', async () => {
    await insertVehicle(db, VEHICLE, vehicleInput, new Date('2026-10-01T10:00:00Z'), '2026-10-01');
    await insertVehicle(db, 'v2', { ...vehicleInput, nickname: 'Truck' }, new Date('2026-10-01T10:00:00Z'), '2026-10-01');
    await sync();
    const push = jest.spyOn(server, 'push');

    await updateOdometer(db, 'v2', 62000, new Date('2026-10-22T13:30:00Z'), TODAY);
    const result = await sync('2026-10-22T14:00:00Z');

    expect(result.pushed).toBe(1);
    const vehiclePushes = push.mock.calls.filter(([table]) => table === 'vehicles');
    expect(vehiclePushes).toHaveLength(1);
    expect(vehiclePushes[0][1].map((row) => row.id)).toEqual(['v2']);
    expect(server.get('vehicles', 'v2')?.odometer_km).toBe(62000);
  });

  it('takes the server time for pushed rows, so the echo on the next pull is skipped', async () => {
    await insertVehicle(db, VEHICLE, vehicleInput, new Date('2026-10-01T10:00:00Z'), '2026-10-01');
    await sync();
    await updateOdometer(db, VEHICLE, 52000, new Date('2026-10-22T13:30:00Z'), TODAY);
    await sync('2026-10-22T14:00:00Z');

    const local = await db.getFirstAsync<{ updated_at: string }>('SELECT updated_at FROM vehicles');
    expect(local?.updated_at).toBe(new Date(String(server.get('vehicles', VEHICLE)?.updated_at)).toISOString());
    expect((await sync('2026-10-22T15:00:00Z')).pulled).toBe(0);
  });

  it('keeps a row marked when the owner edits it while its push is out', async () => {
    await insertVehicle(db, VEHICLE, vehicleInput, new Date('2026-10-01T10:00:00Z'), '2026-10-01');
    const push = server.push.bind(server);
    jest.spyOn(server, 'push').mockImplementation(async (table, rows) => {
      const stored = await push(table, rows);
      if (table === 'vehicles') await updateOdometer(db, VEHICLE, 53000, new Date('2026-10-22T13:00:30Z'), TODAY);
      return stored;
    });

    await sync();

    expect(await dirtyCount('vehicles')).toBe(1);
    expect((await getVehicle(db, VEHICLE))?.odometerKm).toBe(53000);
  });

  it('holds back only the rows the server refuses, and keeps them for the next sync', async () => {
    await insertVehicle(db, VEHICLE, vehicleInput, new Date('2026-10-01T10:00:00Z'), '2026-10-01');
    await insertVehicle(db, 'bad', { ...vehicleInput, nickname: 'Bad' }, new Date('2026-10-01T10:00:00Z'), '2026-10-01');
    server.reject = (row) => row.id === 'bad';

    expect(await sync()).toEqual({ pulled: 0, pushed: 1, rejected: 1 });
    expect(server.get('vehicles', VEHICLE)).toBeDefined();
    expect(server.get('vehicles', 'bad')).toBeUndefined();
    expect(await dirtyCount('vehicles')).toBe(1);
  });

  it('fails the whole sync when the network is down, leaving everything to retry', async () => {
    await insertVehicle(db, VEHICLE, vehicleInput, new Date('2026-10-01T10:00:00Z'), '2026-10-01');
    server.offline = true;

    await expect(sync()).rejects.toThrow('Network request failed');
    expect(await dirtyCount('vehicles')).toBe(1);
    expect(await getLastSyncedAt(db)).toBeNull();
  });
});

describe('pull merge', () => {
  it('brings down rows from another device, including shop-written service records', async () => {
    server.put('vehicles', remoteVehicle());
    server.put('shops', {
      id: 's1',
      user_id: ME,
      place_id: null,
      name: 'Garage Tremblay',
      address: null,
      phone: null,
      latitude: null,
      longitude: null,
      is_favourite: true,
      created_at: '2026-10-01T10:00:00+00:00',
      deleted_at: null,
    });
    server.put('service_records', {
      id: 'r1',
      user_id: ME,
      vehicle_id: VEHICLE,
      item_ids: ['oil_change'],
      performed_on: '2026-10-20',
      odometer_km: 51000,
      cost_cents: 8999,
      currency: 'CAD',
      shop_id: 's1',
      notes: null,
      created_by_tenant_id: 'tenant-1',
      created_at: '2026-10-20T10:00:00.123456+00:00',
      deleted_at: null,
    });
    server.put('customer_links', {
      id: 'l1',
      user_id: ME,
      tenant_id: 'tenant-1',
      consented_at: '2026-10-19T10:00:00+00:00',
      revoked_at: null,
      deleted_at: null,
    });

    expect((await sync()).pulled).toBe(4);

    expect(await listVehicles(db)).toHaveLength(1);
    expect(await db.getFirstAsync('SELECT is_favourite, dirty FROM shops')).toEqual({ is_favourite: 1, dirty: 0 });
    expect(
      await db.getFirstAsync('SELECT item_ids, created_by_tenant_id, created_at, dirty FROM service_records'),
    ).toEqual({
      item_ids: '["oil_change"]',
      created_by_tenant_id: 'tenant-1',
      created_at: '2026-10-20T10:00:00.123Z',
      dirty: 0,
    });
    expect(await db.getFirstAsync('SELECT tenant_id, dirty FROM customer_links')).toEqual({
      tenant_id: 'tenant-1',
      dirty: 0,
    });
    // Nothing pulled is pushed straight back.
    expect(await pendingChanges(db)).toBe('');
  });

  it("never stores other users' rows, such as a shop's linked customers", async () => {
    server.put('vehicles', remoteVehicle());
    server.put('vehicles', remoteVehicle({ id: 'customer-car', user_id: CUSTOMER, nickname: "Customer's car" }));
    server.put('service_records', {
      id: 'customer-record',
      user_id: CUSTOMER,
      vehicle_id: 'customer-car',
      item_ids: ['oil_change'],
      performed_on: '2026-10-20',
      odometer_km: 1000,
      cost_cents: null,
      currency: null,
      shop_id: null,
      notes: null,
      created_by_tenant_id: null,
      created_at: '2026-10-20T10:00:00+00:00',
      deleted_at: null,
    });

    await sync();

    expect((await listVehicles(db)).map((vehicle) => vehicle.id)).toEqual([VEHICLE]);
    expect(await db.getAllAsync('SELECT id FROM service_records')).toEqual([]);
  });

  it('lets a newer remote edit win over an older pending local edit', async () => {
    await insertVehicle(db, VEHICLE, vehicleInput, new Date('2026-10-01T10:00:00Z'), '2026-10-01');
    await sync();
    await updateOdometer(db, VEHICLE, 51000, new Date('2026-10-22T13:10:00Z'), TODAY);
    server.clock = Date.parse('2026-10-22T13:20:00Z');
    server.put('vehicles', remoteVehicle({ odometer_km: 52000 }));

    await sync('2026-10-22T13:30:00Z');

    expect((await getVehicle(db, VEHICLE))?.odometerKm).toBe(52000);
    expect(await dirtyCount('vehicles')).toBe(0);
    expect(server.get('vehicles', VEHICLE)?.odometer_km).toBe(52000);
  });

  it('keeps a newer local edit over an older remote one, then uploads it', async () => {
    await insertVehicle(db, VEHICLE, vehicleInput, new Date('2026-10-01T10:00:00Z'), '2026-10-01');
    await sync();
    server.clock = Date.parse('2026-10-22T13:10:00Z');
    server.put('vehicles', remoteVehicle({ odometer_km: 51000 }));
    await updateOdometer(db, VEHICLE, 52000, new Date('2026-10-22T13:20:00Z'), TODAY);

    await sync('2026-10-22T13:30:00Z');

    expect((await getVehicle(db, VEHICLE))?.odometerKm).toBe(52000);
    expect(server.get('vehicles', VEHICLE)?.odometer_km).toBe(52000);
    expect(await dirtyCount('vehicles')).toBe(0);
  });
});

describe('soft delete', () => {
  it('syncs a local delete up as a row with deleted_at', async () => {
    await insertVehicle(db, VEHICLE, vehicleInput, new Date('2026-10-01T10:00:00Z'), '2026-10-01');
    await sync();
    await deleteVehicle(db, VEHICLE, new Date('2026-10-22T13:10:00Z'));

    await sync('2026-10-22T13:30:00Z');

    expect(server.get('vehicles', VEHICLE)?.deleted_at).toBe('2026-10-22T13:10:00.000Z');
  });

  it('applies a remote delete and hides the row', async () => {
    await insertVehicle(db, VEHICLE, vehicleInput, new Date('2026-10-01T10:00:00Z'), '2026-10-01');
    await sync();
    server.clock = Date.parse('2026-10-22T13:20:00Z');
    server.put('vehicles', remoteVehicle({ deleted_at: '2026-10-22T13:20:00+00:00' }));

    await sync('2026-10-22T13:30:00Z');

    expect(await listVehicles(db)).toEqual([]);
    expect(await db.getFirstAsync('SELECT deleted_at FROM vehicles')).toEqual({
      deleted_at: '2026-10-22T13:20:00.000Z',
    });
  });
});

describe('cursors', () => {
  it('advances per table to the newest row pulled, and pulls from just before it next time', async () => {
    server.put('vehicles', remoteVehicle());
    const newest = String(server.get('vehicles', VEHICLE)?.updated_at);

    await sync();
    expect(await getSetting(db, 'sync.cursor.vehicles')).toBe(new Date(newest).toISOString());
    expect(await getSetting(db, 'sync.cursor.shops')).toBeNull();

    server.pulls = [];
    await sync('2026-10-22T14:00:00Z');
    const since = server.pulls.find((pull) => pull.table === 'vehicles')?.since;
    expect(Date.parse(newest) - Date.parse(String(since))).toBe(60_000);
    expect(server.pulls.find((pull) => pull.table === 'shops')?.since).toBeNull();
  });

  it('lets the server time a new row, so one created offline still reaches devices past it', async () => {
    server.put('vehicles', remoteVehicle());
    await sync();
    const cursor = String(await getSetting(db, 'sync.cursor.vehicles'));

    // Another device created this car offline days ago and only now uploads it.
    const other = createMemoryDb();
    await migrate(other);
    await insertVehicle(other, 'offline-car', vehicleInput, new Date('2026-10-15T09:00:00Z'), '2026-10-15');
    const push = jest.spyOn(server, 'push');
    await syncOnce(other, server, ME, new Date('2026-10-22T13:30:00Z'));
    expect(push.mock.calls.flatMap(([, rows]) => rows).some((row) => 'updated_at' in row)).toBe(false);
    expect(Date.parse(String(server.get('vehicles', 'offline-car')?.updated_at))).toBeGreaterThan(Date.parse(cursor));

    await sync('2026-10-22T14:00:00Z');
    expect((await listVehicles(db)).map((vehicle) => vehicle.id)).toContain('offline-car');
  });

  it('leaves the cursor where it was when a pull fails', async () => {
    server.put('vehicles', remoteVehicle());
    await sync();
    const cursor = await getSetting(db, 'sync.cursor.vehicles');
    server.offline = true;

    await expect(sync('2026-10-22T14:00:00Z')).rejects.toThrow();
    expect(await getSetting(db, 'sync.cursor.vehicles')).toBe(cursor);
  });
});

describe('pending changes', () => {
  it('changes with local edits but not with sync', async () => {
    expect(await pendingChanges(db)).toBe('');
    await insertVehicle(db, VEHICLE, vehicleInput, new Date('2026-10-01T10:00:00Z'), '2026-10-01');
    const before = await pendingChanges(db);
    expect(before).not.toBe('');
    await sync();
    expect(await pendingChanges(db)).toBe('');
  });
});
