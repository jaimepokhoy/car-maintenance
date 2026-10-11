import { createMemoryDb } from '@/test-utils/memory-db';

import { migrate } from '../migrations';
import { listSavedShops, saveShop, shopNames, unsaveShop } from '../shops';
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
});
