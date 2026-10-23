import { createMemoryDb } from '@/test-utils/memory-db';

import { migrate } from '../migrations';
import { ensureTenantShop, listSavedShops, saveShop, shopNames, tenantPlaceId, unsaveShop } from '../shops';
import type { Db } from '../types';

const now = new Date('2026-10-11T12:00:00Z');
let db: Db;

beforeEach(async () => {
  db = createMemoryDb();
  await migrate(db);
});

describe('shops', () => {
  it('saves and lists shops alphabetically', async () => {
    await saveShop(db, 's1', { name: 'zed Auto', placeId: 'p1' }, now);
    await saveShop(db, 's2', { name: 'Atelier B', placeId: 'p2', phone: '555' }, now);
    expect((await listSavedShops(db)).map((s) => s.name)).toEqual(['Atelier B', 'zed Auto']);
  });

  it('reuses the existing row when the same place is saved again', async () => {
    await saveShop(db, 's1', { name: 'Old name', placeId: 'p1' }, now);
    await unsaveShop(db, 's1', now);
    const id = await saveShop(db, 's-new', { name: 'New name', placeId: 'p1' }, now);
    expect(id).toBe('s1');
    expect(await listSavedShops(db)).toEqual([expect.objectContaining({ id: 's1', name: 'New name' })]);
  });

  it('keeps names of unsaved shops for service history', async () => {
    await saveShop(db, 's1', { name: 'Garage', placeId: 'p1' }, now);
    await unsaveShop(db, 's1', now);
    expect(await listSavedShops(db)).toEqual([]);
    expect((await shopNames(db)).get('s1')).toBe('Garage');
  });

  describe('ensureTenantShop', () => {
    const later = new Date('2026-10-12T12:00:00Z');
    const shop = {
      name: 'Demo Auto Service',
      address: '100 Queen St W',
      phone: '+1 416-555-0142',
    };
    const updatedAt = async (id: string) =>
      (await db.getFirstAsync<{ updated_at: string }>('SELECT updated_at FROM shops WHERE id = ?', id))?.updated_at;

    it("saves the app's own shop as a favourite on first launch", async () => {
      expect(await ensureTenantShop(db, 's1', 'demo-shop', shop, now)).toBe('s1');
      expect(await listSavedShops(db)).toEqual([
        expect.objectContaining({
          id: 's1',
          placeId: tenantPlaceId('demo-shop'),
          name: 'Demo Auto Service',
        }),
      ]);
    });

    it('keeps one row across launches and leaves it alone when nothing changed', async () => {
      await ensureTenantShop(db, 's1', 'demo-shop', shop, now);
      expect(await ensureTenantShop(db, 's2', 'demo-shop', shop, later)).toBe('s1');
      expect(await listSavedShops(db)).toHaveLength(1);
      expect(await updatedAt('s1')).toBe(now.toISOString());
    });

    it('refreshes the details when the shop changes them', async () => {
      await ensureTenantShop(db, 's1', 'demo-shop', shop, now);
      await ensureTenantShop(db, 's2', 'demo-shop', { ...shop, phone: '+1 416-555-0199' }, later);
      expect(await listSavedShops(db)).toEqual([expect.objectContaining({ id: 's1', phone: '+1 416-555-0199' })]);
      expect(await updatedAt('s1')).toBe(later.toISOString());
    });

    it('does not save it again once the owner removed it', async () => {
      await ensureTenantShop(db, 's1', 'demo-shop', shop, now);
      await unsaveShop(db, 's1', now);
      await ensureTenantShop(db, 's2', 'demo-shop', shop, later);
      expect(await listSavedShops(db)).toEqual([]);
    });
  });
});
