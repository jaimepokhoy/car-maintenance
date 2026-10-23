import { parsePreferences, type Preferences } from '@/domain';

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
  await setSetting(db, key, value === undefined ? null : String(value));
}

/** A raw settings value, for app state that isn't an owner preference (like sync cursors). */
export async function getSetting(db: Db, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

/** Saves a raw settings value; `null` removes it. */
export async function setSetting(db: Db, key: string, value: string | null): Promise<void> {
  if (value === null) {
    await db.runAsync('DELETE FROM settings WHERE key = ?', key);
    return;
  }
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}
