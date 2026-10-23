import { isCampaignNotification, notificationTarget, pushPlatform } from '../push';

describe('push platform', () => {
  it('offers remote push on iOS and Android only', () => {
    expect(pushPlatform('ios')).toBe('ios');
    expect(pushPlatform('android')).toBe('android');
    expect(pushPlatform('web')).toBeNull();
    expect(pushPlatform('windows')).toBeNull();
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
