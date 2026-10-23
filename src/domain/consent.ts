/**
 * Rules for sharing a customer's vehicles and service history with a shop.
 * A `customer_links` row records consent; revoking keeps the row and sets
 * `revokedAt`, so a later "share again" reuses it (one row per shop and
 * customer, as the server's unique key requires).
 */

import type { ServiceRecord } from './types';

export interface CustomerLink {
  id: string;
  tenantId: string;
  /** ISO timestamp of the latest consent. */
  consentedAt: string;
  /** ISO timestamp, or null while the shop has access. */
  revokedAt: string | null;
}

/** Where a customer stands with one shop. */
export type ConsentStatus = 'shared' | 'revoked' | 'declined' | 'undecided';

export function linkFor(links: readonly CustomerLink[], tenantId: string): CustomerLink | undefined {
  return links.find((link) => link.tenantId === tenantId);
}

export function consentStatus(links: readonly CustomerLink[], tenantId: string, declined: boolean): ConsentStatus {
  const link = linkFor(links, tenantId);
  if (link) return link.revokedAt === null ? 'shared' : 'revoked';
  return declined ? 'declined' : 'undecided';
}

export interface ConsentPromptInput {
  /** True only in a shop's own app. */
  branded: boolean;
  signedIn: boolean;
  /**
   * True once this device finished a sync for the signed-in account, so a
   * link made on another device is already here and isn't asked for twice.
   */
  synced: boolean;
  /** The shop's id from its live profile; unknown until the app reaches Supabase. */
  tenantId: string | null;
  links: readonly CustomerLink[];
  declined: boolean;
}

/**
 * Whether a branded app should ask, once, to share with its shop. A customer
 * who declined or later revoked isn't asked again; Settings offers it instead.
 */
export function shouldAskConsent(input: ConsentPromptInput): boolean {
  if (!input.branded || !input.signedIn || !input.synced || !input.tenantId) return false;
  return consentStatus(input.links, input.tenantId, input.declined) === 'undecided';
}

/**
 * The link to save when the customer agrees: the existing row for that shop
 * with its revocation cleared, or a new one with `newId`.
 */
export function grantConsent(links: readonly CustomerLink[], tenantId: string, newId: string, now: Date): CustomerLink {
  const existing = linkFor(links, tenantId);
  return {
    id: existing?.id ?? newId,
    tenantId,
    consentedAt: now.toISOString(),
    revokedAt: null,
  };
}

export function revokeConsent(link: CustomerLink, now: Date): CustomerLink {
  return { ...link, revokedAt: now.toISOString() };
}

/** Links whose shop can currently see the customer's data. */
export function activeLinks(links: readonly CustomerLink[]): CustomerLink[] {
  return links.filter((link) => link.revokedAt === null);
}

/** True for a service a shop logged into the customer's history from its portal. */
export function isShopLogged(record: Pick<ServiceRecord, 'createdByTenantId'>): boolean {
  return !!record.createdByTenantId;
}

/**
 * Which fields of a service record the customer may change. A shop-logged
 * record is the shop's account of the work, so only the customer's own notes
 * stay editable and the record can't be deleted from the app.
 */
export function serviceRecordPermissions(record: Pick<ServiceRecord, 'createdByTenantId'>): {
  editNotes: boolean;
  editDetails: boolean;
  delete: boolean;
} {
  const shop = isShopLogged(record);
  return { editNotes: true, editDetails: !shop, delete: !shop };
}
