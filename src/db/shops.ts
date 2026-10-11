import type { Db } from './types';

export interface SavedShop {
  id: string;
  placeId?: string;
  name: string;
  address?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
}

interface ShopRow {
  id: string;
  place_id: string | null;
  name: string;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
}

function toShop(row: ShopRow): SavedShop {
  return {
    id: row.id,
    placeId: row.place_id ?? undefined,
    name: row.name,
    address: row.address ?? undefined,
    phone: row.phone ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
  };
}

/** The owner's saved shops ("my shops"), alphabetical. */
export async function listSavedShops(db: Db): Promise<SavedShop[]> {
  const rows = await db.getAllAsync<ShopRow>(
    `SELECT id, place_id, name, address, phone, latitude, longitude FROM shops
     WHERE deleted_at IS NULL AND is_favourite = 1 ORDER BY name COLLATE NOCASE`,
  );
  return rows.map(toShop);
}

/**
 * Saves a shop, or restores it if it was saved before (matched by place ID),
 * and returns its ID.
 */
export async function saveShop(db: Db, id: string, shop: Omit<SavedShop, 'id'>, now: Date): Promise<string> {
  const timestamp = now.toISOString();
  if (shop.placeId) {
    const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM shops WHERE place_id = ?', shop.placeId);
    if (existing) {
      await db.runAsync(
        `UPDATE shops SET name = ?, address = ?, phone = ?, latitude = ?, longitude = ?, is_favourite = 1,
           deleted_at = NULL, updated_at = ?, dirty = 1
         WHERE id = ?`,
        shop.name,
        shop.address ?? null,
        shop.phone ?? null,
        shop.latitude ?? null,
        shop.longitude ?? null,
        timestamp,
        existing.id,
      );
      return existing.id;
    }
  }
  await db.runAsync(
    `INSERT INTO shops (id, place_id, name, address, phone, latitude, longitude, is_favourite, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    id,
    shop.placeId ?? null,
    shop.name,
    shop.address ?? null,
    shop.phone ?? null,
    shop.latitude ?? null,
    shop.longitude ?? null,
    timestamp,
    timestamp,
  );
  return id;
}

/**
 * Removes a shop from "my shops". The row stays so past services keep
 * showing where they were done.
 */
export async function unsaveShop(db: Db, id: string, now: Date): Promise<void> {
  await db.runAsync('UPDATE shops SET is_favourite = 0, updated_at = ?, dirty = 1 WHERE id = ?', now.toISOString(), id);
}

/** Names for every shop referenced by service history, saved or not. */
export async function shopNames(db: Db): Promise<Map<string, string>> {
  const rows = await db.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM shops');
  return new Map(rows.map((row) => [row.id, row.name]));
}
