import { grantConsent, revokeConsent } from '@/domain';
import { createMemoryDb } from '@/test-utils/memory-db';

import {
  cacheTenantNames,
  getTenantNames,
  isConsentDeclined,
  listCustomerLinks,
  saveCustomerLink,
  setConsentDeclined,
  unnamedTenantIds,
} from '../customer-links';
import { migrate } from '../migrations';
import { listServiceRecords, logService, updateServiceNotes } from '../service-records';
import type { Db } from '../types';
import { insertVehicle } from '../vehicles';

const SHOP = 'aaaaaaaa-0000-4000-8000-000000000000';
const OTHER = 'bbbbbbbb-0000-4000-8000-000000000000';
const now = new Date('2026-10-22T12:00:00Z');
const later = new Date('2026-10-23T12:00:00Z');
let db: Db;

async function addShopService() {
  const vehicle = {
    nickname: 'Civic',
    year: 2020,
    make: 'Honda',
    model: 'Civic',
    powertrain: 'gas' as const,
    odometerKm: 1000,
  };
  await insertVehicle(db, 'v1', vehicle, now, '2026-10-22');
  const record = {
    id: 'r1',
    vehicleId: 'v1',
    itemIds: ['oil_change' as const],
    performedOn: '2026-10-22',
    odometerKm: 1000,
  };
  await logService(db, record, now);
}

beforeEach(async () => {
  db = await createMemoryDb();
  await migrate(db);
});

describe('customer links', () => {
  it('saves a consent marked for sync', async () => {
    await saveCustomerLink(db, grantConsent([], SHOP, 'l1', now), now);
    expect(await listCustomerLinks(db)).toEqual([
      {
        id: 'l1',
        tenantId: SHOP,
        consentedAt: now.toISOString(),
        revokedAt: null,
      },
    ]);
    expect(await db.getFirstAsync('SELECT dirty, updated_at FROM customer_links')).toEqual({
      dirty: 1,
      updated_at: now.toISOString(),
    });
  });

  it('revokes and shares again on the same row', async () => {
    await saveCustomerLink(db, grantConsent([], SHOP, 'l1', now), now);
    await db.runAsync('UPDATE customer_links SET dirty = 0');
    const [link] = await listCustomerLinks(db);
    await saveCustomerLink(db, revokeConsent(link, later), later);
    expect(await listCustomerLinks(db)).toEqual([{ ...link, revokedAt: later.toISOString() }]);
    expect(await db.getFirstAsync('SELECT dirty FROM customer_links')).toEqual({
      dirty: 1,
    });

    await saveCustomerLink(db, grantConsent(await listCustomerLinks(db), SHOP, 'l2', later), later);
    expect(await listCustomerLinks(db)).toEqual([
      {
        id: 'l1',
        tenantId: SHOP,
        consentedAt: later.toISOString(),
        revokedAt: null,
      },
    ]);
  });

  it('remembers a decline per shop', async () => {
    expect(await isConsentDeclined(db, SHOP)).toBe(false);
    await setConsentDeclined(db, SHOP, now);
    expect(await isConsentDeclined(db, SHOP)).toBe(true);
    expect(await isConsentDeclined(db, OTHER)).toBe(false);
  });
});

describe('tenant names', () => {
  it('lists shops it has no name for, from links and shop-logged services', async () => {
    await saveCustomerLink(db, grantConsent([], SHOP, 'l1', now), now);
    await addShopService();
    await db.runAsync('UPDATE service_records SET created_by_tenant_id = ?', OTHER);

    expect((await unnamedTenantIds(db)).sort()).toEqual([SHOP, OTHER]);
    await cacheTenantNames(db, [{ id: SHOP, name: 'Demo Auto Service' }]);
    expect(await unnamedTenantIds(db)).toEqual([OTHER]);
    await cacheTenantNames(db, [{ id: SHOP, name: 'Demo Auto' }]);
    expect((await getTenantNames(db)).get(SHOP)).toBe('Demo Auto');
  });
});

describe('shop-logged service records', () => {
  it('reads the shop that logged a service and lets notes change', async () => {
    await addShopService();
    await db.runAsync('UPDATE service_records SET created_by_tenant_id = ?, dirty = 0', SHOP);

    await updateServiceNotes(db, 'r1', '  Asked about wipers  ', later);
    const [record] = await listServiceRecords(db, 'v1');
    expect(record).toEqual(
      expect.objectContaining({
        createdByTenantId: SHOP,
        notes: 'Asked about wipers',
      }),
    );
    expect(await db.getFirstAsync('SELECT dirty, updated_at FROM service_records')).toEqual({
      dirty: 1,
      updated_at: later.toISOString(),
    });

    await updateServiceNotes(db, 'r1', ' ', later);
    expect((await listServiceRecords(db, 'v1'))[0].notes).toBeUndefined();
  });
});
