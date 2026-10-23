/**
 * Sync round trip against a real Supabase, such as the local stack from
 * `npx supabase start`. Skipped unless these are set (values from
 * `npx supabase status -o env`), and skipped with a warning when the server
 * doesn't answer:
 *
 *   SUPABASE_TEST_URL=http://127.0.0.1:54321
 *   SUPABASE_TEST_ANON_KEY=<ANON_KEY>
 *   SUPABASE_TEST_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
 *
 * It creates throwaway users and a tenant, and deletes them afterwards.
 */
import { randomUUID } from 'node:crypto';
import http from 'node:http';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { listCustomerLinks, saveCustomerLink } from '@/db/customer-links';
import { migrate } from '@/db/migrations';
import { logService, deleteServiceRecord } from '@/db/service-records';
import { saveShop } from '@/db/shops';
import { syncOnce } from '@/db/sync';
import type { Db } from '@/db/types';
import { grantConsent, revokeConsent } from '@/domain';
import { getVehicle, insertVehicle, listVehicles, updateOdometer, updateVehicleDetails } from '@/db/vehicles';
import { createMemoryDb } from '@/test-utils/memory-db';

import { createSupabaseRemote } from '../sync';

const url = process.env.SUPABASE_TEST_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

/**
 * The Expo test setup replaces `fetch` with a stub, so requests here go
 * through Node's `http` directly. It covers what supabase-js reads from a response.
 */
function nodeFetch(input: string | URL | Request, init: RequestInit = {}): Promise<Response> {
  return new Promise((resolve, reject) => {
    const headers = Object.fromEntries(new Headers(init.headers as HeadersInit).entries());
    const request = http.request(String(input), { method: init.method ?? 'GET', headers }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        const status = response.statusCode ?? 0;
        resolve({
          ok: status >= 200 && status < 300,
          status,
          statusText: response.statusMessage ?? '',
          headers: { get: (name: string) => [response.headers[name.toLowerCase()] ?? null].flat()[0] ?? null },
          text: async () => text,
          json: async () => JSON.parse(text),
        } as unknown as Response);
      });
    });
    request.on('error', reject);
    if (init.body) request.write(init.body as string);
    request.end();
  });
}

const options = {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: nodeFetch as typeof fetch },
};
const password = `Sync-${randomUUID()}`;
const hour = 60 * 60_000;
const today = () => new Date().toISOString().slice(0, 10);

interface Account {
  id: string;
  client: SupabaseClient;
}

/** One phone: its own database, signed in as `account`. */
async function device(account: Account) {
  const db = createMemoryDb();
  await migrate(db);
  const remote = createSupabaseRemote(account.client, account.id);
  return { db, sync: (now = new Date()) => syncOnce(db, remote, account.id, now) };
}

const vehicleInput = { nickname: 'Civic', year: 2018, make: 'Honda', model: 'Civic', powertrain: 'gas', odometerKm: 50000 } as const;

const count = async (db: Db, sql: string, ...params: string[]) =>
  (await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM (${sql})`, ...params))!.n;

(url && anonKey && serviceKey ? describe : describe.skip)('sync against Supabase', () => {
  let admin: SupabaseClient;
  const userIds: string[] = [];
  let tenantId: string | undefined;
  let reachable = false;
  let customer: Account;
  let staff: Account;

  async function account(): Promise<Account> {
    const email = `sync-${randomUUID()}@example.test`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw created.error;
    userIds.push(created.data.user.id);
    const client = createClient(url!, anonKey!, options);
    const signedIn = await client.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw signedIn.error;
    return { id: created.data.user.id, client };
  }

  beforeAll(async () => {
    try {
      reachable = (await nodeFetch(`${url}/auth/v1/health`, { headers: { apikey: anonKey! } })).ok;
    } catch {
      reachable = false;
    }
    if (!reachable) {
      console.warn(`Supabase at ${url} isn't reachable; skipping the sync round trip.`);
      return;
    }
    admin = createClient(url!, serviceKey!, options);
    customer = await account();
    staff = await account();
    const tenant = await admin
      .from('tenants')
      .insert({ slug: `sync-test-${randomUUID().slice(0, 8)}`, name: 'Garage Tremblay' })
      .select('id')
      .single();
    if (tenant.error) throw tenant.error;
    tenantId = tenant.data.id;
    const role = await admin.from('tenant_staff').insert({ tenant_id: tenantId, user_id: staff.id, role: 'staff' });
    if (role.error) throw role.error;
  }, 30_000);

  afterAll(async () => {
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
    if (tenantId) await admin.from('tenants').delete().eq('id', tenantId);
  });

  it('round-trips edits, deletes, conflicts and shop records between two phones, and never to linked staff', async () => {
    if (!reachable) return;
    const phoneA = await device(customer);
    const phoneB = await device(customer);
    const car = randomUUID();
    const record = randomUUID();

    // Phone A has data from before signing in, including consent for the shop.
    await insertVehicle(phoneA.db, car, vehicleInput, new Date(Date.now() - 2 * hour), today());
    const shop = await saveShop(phoneA.db, randomUUID(), { name: 'Garage Tremblay' }, new Date());
    await logService(
      phoneA.db,
      { id: record, vehicleId: car, itemIds: ['oil_change'], performedOn: today(), odometerKm: 51000, shopId: shop },
      new Date(),
    );
    await phoneA.db.runAsync(
      'INSERT INTO customer_links (id, tenant_id, consented_at, updated_at) VALUES (?, ?, ?, ?)',
      randomUUID(),
      tenantId!,
      new Date().toISOString(),
      new Date().toISOString(),
    );
    expect(await phoneA.sync()).toEqual({ pulled: 0, pushed: 4, rejected: 0 });

    // The shop logs a service for its linked customer.
    const shopRecord = randomUUID();
    const written = await staff.client.from('service_records').insert({
      id: shopRecord,
      user_id: customer.id,
      vehicle_id: car,
      item_ids: ['tire_rotation'],
      performed_on: today(),
      odometer_km: 51500,
      created_by_tenant_id: tenantId,
    });
    expect(written.error).toBeNull();

    // Phone B signs in to the same account and gets everything.
    expect((await phoneB.sync()).pulled).toBe(5);
    expect((await getVehicle(phoneB.db, car))?.odometerKm).toBe(51000);
    expect(
      await phoneB.db.getFirstAsync('SELECT created_by_tenant_id FROM service_records WHERE id = ?', shopRecord),
    ).toEqual({ created_by_tenant_id: tenantId });
    expect(await count(phoneB.db, 'SELECT id FROM customer_links')).toBe(1);

    // An edit and a delete on phone A reach phone B.
    await updateOdometer(phoneA.db, car, 60000, new Date(), today());
    await deleteServiceRecord(phoneA.db, record, new Date());
    await phoneA.sync();
    await phoneB.sync();
    expect((await getVehicle(phoneB.db, car))?.odometerKm).toBe(60000);
    expect(await count(phoneB.db, 'SELECT id FROM service_records WHERE id = ? AND deleted_at IS NOT NULL', record)).toBe(1);

    // A car phone A created offline with an old clock still reaches phone B.
    const offlineCar = randomUUID();
    await insertVehicle(phoneA.db, offlineCar, { ...vehicleInput, nickname: 'Old' }, new Date(Date.now() - 72 * hour), today());
    await phoneA.sync();
    await phoneB.sync();
    expect((await listVehicles(phoneB.db)).map((vehicle) => vehicle.id)).toContain(offlineCar);

    // Last write wins: phone B's older pending edit loses to phone A's newer upload…
    const details = { ...vehicleInput, nickname: 'Civic' };
    await updateVehicleDetails(phoneB.db, car, { ...details, nickname: 'Stale' }, new Date(Date.now() - hour));
    await updateVehicleDetails(phoneA.db, car, { ...details, nickname: 'Fresh' }, new Date());
    await phoneA.sync();
    await phoneB.sync();
    expect((await getVehicle(phoneB.db, car))?.nickname).toBe('Fresh');

    // …and its newer pending edit beats an older remote one, then reaches phone A.
    await updateVehicleDetails(phoneA.db, car, { ...details, nickname: 'Older' }, new Date());
    await phoneA.sync();
    await updateVehicleDetails(phoneB.db, car, { ...details, nickname: 'Newer' }, new Date(Date.now() + hour));
    await phoneB.sync();
    await phoneA.sync();
    expect((await getVehicle(phoneB.db, car))?.nickname).toBe('Newer');
    expect((await getVehicle(phoneA.db, car))?.nickname).toBe('Newer');

    // Staff can read the linked customer's rows through RLS…
    const visible = await staff.client.from('vehicles').select('id').eq('id', car);
    expect(visible.data).toHaveLength(1);
    // …but the staff member's own phone never stores them.
    const staffPhone = await device(staff);
    expect(await staffPhone.sync()).toEqual({ pulled: 0, pushed: 0, rejected: 0 });
    for (const table of ['vehicles', 'shops', 'service_records', 'maintenance_intervals', 'customer_links']) {
      expect(await count(staffPhone.db, `SELECT * FROM ${table}`)).toBe(0);
    }
  }, 60_000);

  it('gives the shop access on consent, takes it away on revoke and reuses the link when shared again', async () => {
    if (!reachable) return;
    const owner = await account();
    const phone = await device(owner);
    const car = randomUUID();
    await insertVehicle(phone.db, car, vehicleInput, new Date(), today());
    const staffSees = async () => (await staff.client.from('vehicles').select('id').eq('id', car)).data?.length;

    await phone.sync();
    expect(await staffSees()).toBe(0);

    await saveCustomerLink(phone.db, grantConsent([], tenantId!, randomUUID(), new Date()), new Date());
    expect((await phone.sync()).rejected).toBe(0);
    expect(await staffSees()).toBe(1);

    const [link] = await listCustomerLinks(phone.db);
    await saveCustomerLink(phone.db, revokeConsent(link, new Date()), new Date());
    expect((await phone.sync()).rejected).toBe(0);
    expect(await staffSees()).toBe(0);

    // A new id would break the server's one-link-per-shop rule; sharing again reuses the row.
    await saveCustomerLink(
      phone.db,
      grantConsent(await listCustomerLinks(phone.db), tenantId!, randomUUID(), new Date()),
      new Date(),
    );
    expect((await phone.sync()).rejected).toBe(0);
    expect(await staffSees()).toBe(1);
    const links = await owner.client.from('customer_links').select('id, revoked_at').eq('user_id', owner.id);
    expect(links.data).toEqual([{ id: link.id, revoked_at: null }]);
  }, 60_000);
});
