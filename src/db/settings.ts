import { parsePreferences, type Preferences } from '@/domain';
import { parseTenantProfile, type TenantProfile } from '@/domain/brand';

import type { Db } from './types';

export async function getPreferences(db: Db): Promise<Preferences> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  return parsePreferences(Object.fromEntries(rows.map((row) => [row.key, row.value])));
}

export async function setPreference<K extends keyof Preferences>(
  db: Db,
  key: K,
  value: Preferences[K],
): Promise<void> {
  if (value === undefined) {
    await db.runAsync('DELETE FROM settings WHERE key = ?', key);
    return;
  }
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    key,
    String(value),
  );
}

const TENANT_PROFILE_KEY = 'tenantProfile';

/** The shop profile last fetched from Supabase, so a branded app keeps its brand offline. */
export async function getCachedTenantProfile(db: Db): Promise<TenantProfile | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', TENANT_PROFILE_KEY);
  if (!row) return null;
  try {
    return parseTenantProfile(JSON.parse(row.value));
  } catch {
    return null;
  }
}

export async function setCachedTenantProfile(db: Db, profile: TenantProfile | null): Promise<void> {
  if (profile === null) {
    await db.runAsync('DELETE FROM settings WHERE key = ?', TENANT_PROFILE_KEY);
    return;
  }
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    TENANT_PROFILE_KEY,
    JSON.stringify(profile),
  );
}
