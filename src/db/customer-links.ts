import type { CustomerLink } from '@/domain';

import { getSetting, setSetting } from './settings';
import type { Db } from './types';

interface LinkRow {
  id: string;
  tenant_id: string;
  consented_at: string;
  revoked_at: string | null;
}

function toLink(row: LinkRow): CustomerLink {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    consentedAt: row.consented_at,
    revokedAt: row.revoked_at,
  };
}

/** Every shop this customer has answered "share" for, newest consent first, revoked ones included. */
export async function listCustomerLinks(db: Db): Promise<CustomerLink[]> {
  const rows = await db.getAllAsync<LinkRow>(
    `SELECT id, tenant_id, consented_at, revoked_at FROM customer_links
     WHERE deleted_at IS NULL
     ORDER BY consented_at DESC`,
  );
  return rows.map(toLink);
}

/** Inserts or updates a link and marks it for sync, which sends it to Supabase. */
export async function saveCustomerLink(db: Db, link: CustomerLink, now: Date): Promise<void> {
  await db.runAsync(
    `INSERT INTO customer_links (id, tenant_id, consented_at, revoked_at, updated_at, dirty)
     VALUES (?, ?, ?, ?, ?, 1)
     ON CONFLICT (id) DO UPDATE SET
       consented_at = excluded.consented_at, revoked_at = excluded.revoked_at,
       updated_at = excluded.updated_at, deleted_at = NULL, dirty = 1`,
    link.id,
    link.tenantId,
    link.consentedAt,
    link.revokedAt,
    now.toISOString(),
  );
}

const declinedKey = (tenantId: string) => `consent.declined.${tenantId}`;

/** True once the customer said "not now" to sharing with this shop on this device. */
export async function isConsentDeclined(db: Db, tenantId: string): Promise<boolean> {
  return (await getSetting(db, declinedKey(tenantId))) !== null;
}

export async function setConsentDeclined(db: Db, tenantId: string, now: Date): Promise<void> {
  await setSetting(db, declinedKey(tenantId), now.toISOString());
}

/** Cached shop names by tenant id. */
export async function getTenantNames(db: Db): Promise<Map<string, string>> {
  const rows = await db.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM tenant_names');
  return new Map(rows.map((row) => [row.id, row.name]));
}

export async function cacheTenantNames(db: Db, names: readonly { id: string; name: string }[]): Promise<void> {
  for (const { id, name } of names) {
    await db.runAsync(
      'INSERT INTO tenant_names (id, name) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET name = excluded.name',
      id,
      name,
    );
  }
}

/** Tenant ids the device knows about (links and shop-logged services) but has no name for yet. */
export async function unnamedTenantIds(db: Db): Promise<string[]> {
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT tenant_id AS id FROM customer_links
     UNION SELECT created_by_tenant_id FROM service_records WHERE created_by_tenant_id IS NOT NULL
     EXCEPT SELECT id FROM tenant_names`,
  );
  return rows.map((row) => row.id);
}
