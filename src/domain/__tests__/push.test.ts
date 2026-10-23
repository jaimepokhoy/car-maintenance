import { isCampaignNotification, notificationTarget, pushPlatform, tenantSlugFromExtra } from '../push';

describe('push platform', () => {
  it('offers remote push on iOS and Android only', () => {
    expect(pushPlatform('ios')).toBe('ios');
    expect(pushPlatform('android')).toBe('android');
    expect(pushPlatform('web')).toBeNull();
    expect(pushPlatform('windows')).toBeNull();
  });
});

describe('tenant slug', () => {
  it('reads the shop slug a branded build carries', () => {
    expect(tenantSlugFromExtra({ tenant: { slug: 'garage-tremblay' } })).toBe('garage-tremblay');
  });

  it('has no shop in the unbranded app', () => {
    expect(tenantSlugFromExtra(undefined)).toBeNull();
    expect(tenantSlugFromExtra(null)).toBeNull();
    expect(tenantSlugFromExtra({})).toBeNull();
    expect(tenantSlugFromExtra({ eas: { projectId: 'x' } })).toBeNull();
    expect(tenantSlugFromExtra({ tenant: { slug: 'default' } })).toBeNull();
  });

  it('ignores a slug that is not a usable string', () => {
    expect(tenantSlugFromExtra({ tenant: { slug: '' } })).toBeNull();
    expect(tenantSlugFromExtra({ tenant: { slug: 42 } })).toBeNull();
    expect(tenantSlugFromExtra({ tenant: 'garage-tremblay' })).toBeNull();
  });
});

describe('tapped notifications', () => {
  it('recognises shop campaigns', () => {
    expect(isCampaignNotification({ type: 'campaign' })).toBe(true);
    expect(isCampaignNotification({ type: 'reminder' })).toBe(false);
    expect(isCampaignNotification(undefined)).toBe(false);
  });

  it('opens the home tab for a campaign', () => {
    expect(notificationTarget({ type: 'campaign', campaignId: 'c1' })).toBe('/');
    expect(notificationTarget({ type: 'campaign', url: '/vehicles/v1' })).toBe('/');
  });

  it("opens a local reminder's screen", () => {
    expect(notificationTarget({ url: '/vehicles/v1' })).toBe('/vehicles/v1');
    expect(notificationTarget({ url: '/vehicles/v1/odometer' })).toBe('/vehicles/v1/odometer');
  });

  it('stays put for anything else', () => {
    expect(notificationTarget(undefined)).toBeNull();
    expect(notificationTarget({})).toBeNull();
    expect(notificationTarget({ url: 42 })).toBeNull();
    expect(notificationTarget({ url: 'https://example.com' })).toBeNull();
  });
});
