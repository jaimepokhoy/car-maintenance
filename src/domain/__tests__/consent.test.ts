import {
  activeLinks,
  consentStatus,
  grantConsent,
  isShopLogged,
  revokeConsent,
  serviceRecordPermissions,
  shouldAskConsent,
  type CustomerLink,
} from '../consent';

const SHOP = 'aaaaaaaa-0000-4000-8000-000000000000';
const OTHER = 'bbbbbbbb-0000-4000-8000-000000000000';
const now = new Date('2026-10-22T12:00:00Z');

const shared: CustomerLink = {
  id: 'l1',
  tenantId: SHOP,
  consentedAt: '2026-10-01T00:00:00.000Z',
  revokedAt: null,
};
const revoked: CustomerLink = {
  ...shared,
  revokedAt: '2026-10-10T00:00:00.000Z',
};

describe('consent status', () => {
  it('is shared while a link has no revocation', () => {
    expect(consentStatus([shared], SHOP, false)).toBe('shared');
  });

  it('is revoked once the customer withdrew access', () => {
    expect(consentStatus([revoked], SHOP, false)).toBe('revoked');
  });

  it('is declined or undecided when there is no link for that shop', () => {
    expect(consentStatus([{ ...shared, tenantId: OTHER }], SHOP, true)).toBe('declined');
    expect(consentStatus([], SHOP, false)).toBe('undecided');
  });

  it('prefers a link over a remembered decline, e.g. one made on another device', () => {
    expect(consentStatus([shared], SHOP, true)).toBe('shared');
  });
});

describe('asking for consent', () => {
  const ready = {
    branded: true,
    signedIn: true,
    synced: true,
    tenantId: SHOP,
    links: [],
    declined: false,
  };

  it('asks once a signed-in customer of a branded app has synced', () => {
    expect(shouldAskConsent(ready)).toBe(true);
  });

  it('never asks in the unbranded app, signed out, before the first sync or without the shop id', () => {
    expect(shouldAskConsent({ ...ready, branded: false })).toBe(false);
    expect(shouldAskConsent({ ...ready, signedIn: false })).toBe(false);
    expect(shouldAskConsent({ ...ready, synced: false })).toBe(false);
    expect(shouldAskConsent({ ...ready, tenantId: null })).toBe(false);
  });

  it('does not ask again after the customer answered', () => {
    expect(shouldAskConsent({ ...ready, declined: true })).toBe(false);
    expect(shouldAskConsent({ ...ready, links: [shared] })).toBe(false);
    expect(shouldAskConsent({ ...ready, links: [revoked] })).toBe(false);
  });

  it('still asks when only another shop has access', () => {
    expect(shouldAskConsent({ ...ready, links: [{ ...shared, tenantId: OTHER }] })).toBe(true);
  });
});

describe('granting and revoking', () => {
  it('creates a new link with the given id', () => {
    expect(grantConsent([], SHOP, 'new-id', now)).toEqual({
      id: 'new-id',
      tenantId: SHOP,
      consentedAt: now.toISOString(),
      revokedAt: null,
    });
  });

  it('reuses a revoked link so there is one row per shop', () => {
    expect(grantConsent([revoked], SHOP, 'new-id', now)).toEqual({
      id: 'l1',
      tenantId: SHOP,
      consentedAt: now.toISOString(),
      revokedAt: null,
    });
  });

  it('revokes by stamping the time and keeps the row', () => {
    expect(revokeConsent(shared, now)).toEqual({
      ...shared,
      revokedAt: now.toISOString(),
    });
  });

  it('lists only links the shop can still use', () => {
    expect(activeLinks([shared, { ...revoked, id: 'l2', tenantId: OTHER }])).toEqual([shared]);
  });
});

describe('shop-logged service records', () => {
  it('lets the customer edit only notes on a shop record', () => {
    expect(isShopLogged({ createdByTenantId: SHOP })).toBe(true);
    expect(serviceRecordPermissions({ createdByTenantId: SHOP })).toEqual({
      editNotes: true,
      editDetails: false,
      delete: false,
    });
  });

  it('leaves the customer full control of their own records', () => {
    expect(isShopLogged({})).toBe(false);
    expect(serviceRecordPermissions({})).toEqual({
      editNotes: true,
      editDetails: true,
      delete: true,
    });
  });
});
