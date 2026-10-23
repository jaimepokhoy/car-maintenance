import {
  CAMPAIGN_BODY_MAX,
  CAMPAIGN_LIMIT,
  CAMPAIGN_TITLE_MAX,
  type AudienceInput,
  type ExpoPushTicket,
  buildPushMessages,
  campaignAllowance,
  chunk,
  isExpoPushToken,
  mergeBatches,
  pushTargets,
  selectAudience,
  tallyBatch,
  validateCampaign,
} from '../campaigns';
import type { ServiceRecord } from '../types';

describe('validateCampaign', () => {
  it('trims and accepts a complete campaign', () => {
    expect(validateCampaign({ title: '  Winter tires  ', body: ' Book your swap. ', audience: 'due_soon' })).toEqual({
      ok: true,
      campaign: { title: 'Winter tires', body: 'Book your swap.', audience: 'due_soon' },
    });
  });

  it('requires a title and a body', () => {
    expect(validateCampaign({ title: '  ', body: '', audience: 'all' })).toEqual({
      ok: false,
      errors: { title: 'required', body: 'required' },
    });
  });

  it('limits the length of the title and body', () => {
    const result = validateCampaign({
      title: 'x'.repeat(CAMPAIGN_TITLE_MAX + 1),
      body: 'x'.repeat(CAMPAIGN_BODY_MAX + 1),
      audience: 'all',
    });
    expect(result).toEqual({ ok: false, errors: { title: 'tooLong', body: 'tooLong' } });
    expect(validateCampaign({ title: 'x'.repeat(CAMPAIGN_TITLE_MAX), body: 'x'.repeat(CAMPAIGN_BODY_MAX), audience: 'all' }).ok).toBe(true);
  });

  it('only knows the two audiences', () => {
    expect(validateCampaign({ title: 'Hi', body: 'There', audience: 'everyone' })).toEqual({
      ok: false,
      errors: { audience: 'invalid' },
    });
    expect(validateCampaign({ title: 'Hi', body: 'There' })).toEqual({ ok: false, errors: { audience: 'invalid' } });
  });
});

describe('campaignAllowance', () => {
  const now = new Date('2026-10-22T12:00:00Z');
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

  it('allows four sends in 30 days', () => {
    expect(campaignAllowance([], now)).toEqual({ remaining: CAMPAIGN_LIMIT, nextAvailableAt: null });
    expect(campaignAllowance([{ sentAt: daysAgo(1), sentCount: 10 }], now)).toEqual({ remaining: 3, nextAvailableAt: null });
  });

  it('says when the next send frees up once the limit is reached', () => {
    const sent = [5, 1, 20, 10].map((days) => ({ sentAt: daysAgo(days), sentCount: 3 }));
    expect(campaignAllowance(sent, now)).toEqual({ remaining: 0, nextAvailableAt: '2026-11-01T12:00:00.000Z' });
  });

  it('frees up at the right send when over the limit', () => {
    // Five in the window (e.g. sent concurrently): the second oldest has to expire.
    const sent = [25, 20, 15, 10, 5].map((days) => ({ sentAt: daysAgo(days), sentCount: 1 }));
    expect(campaignAllowance(sent, now)).toEqual({ remaining: 0, nextAvailableAt: daysAgo(20 - 30) });
  });

  it('forgets sends older than the window', () => {
    const sent = [31, 30, 40, 2].map((days) => ({ sentAt: daysAgo(days), sentCount: 3 }));
    expect(campaignAllowance(sent, now).remaining).toBe(3);
  });

  it('does not count a send that reached nobody, but counts one still sending', () => {
    const sent = [
      { sentAt: daysAgo(1), sentCount: 0 },
      { sentAt: daysAgo(1), sentCount: null },
    ];
    expect(campaignAllowance(sent, now).remaining).toBe(3);
  });
});

describe('selectAudience', () => {
  const today = '2026-10-22';
  const record = (id: string, vehicleId: string, performedOn: string, odometerKm: number, itemIds: ServiceRecord['itemIds'] = ['oil_change']): ServiceRecord => ({
    id,
    vehicleId,
    itemIds,
    performedOn,
    odometerKm,
  });

  const input: AudienceInput = {
    customerIds: ['due-soon', 'ok', 'overdue', 'no-history', 'override', 'shop-ahead'],
    vehicles: [
      { id: 'v-due-soon', userId: 'due-soon', powertrain: 'gas', odometerKm: 52_000 },
      { id: 'v-ok', userId: 'ok', powertrain: 'gas', odometerKm: 51_000 },
      { id: 'v-overdue', userId: 'overdue', powertrain: 'hybrid', odometerKm: 90_000 },
      { id: 'v-none', userId: 'no-history', powertrain: 'ev', odometerKm: 10_000 },
      { id: 'v-override', userId: 'override', powertrain: 'gas', odometerKm: 51_000 },
      { id: 'v-shop', userId: 'shop-ahead', powertrain: 'gas', odometerKm: 50_000 },
      { id: 'v-stranger', userId: 'stranger', powertrain: 'gas', odometerKm: 90_000 },
    ],
    records: [
      // Oil every 6 months: due 2026-11-01, 10 days away.
      record('r1', 'v-due-soon', '2026-05-01', 50_000),
      record('r2', 'v-ok', '2026-10-01', 50_000),
      record('r3', 'v-overdue', '2025-01-01', 70_000),
      record('r4', 'v-override', '2026-10-01', 50_000),
      record('r5', 'v-shop', '2026-10-01', 50_000),
      // Logged by the shop at 57,500 km; the vehicle row still says 50,000.
      record('r6', 'v-shop', '2026-10-20', 57_500, ['tire_rotation']),
      record('r7', 'v-stranger', '2020-01-01', 10_000),
    ],
    // Owner shortened oil changes to 1,500 km: 500 km left.
    intervals: [{ vehicleId: 'v-override', itemId: 'oil_change', everyKm: 1_500 }],
    today,
  };

  it('sends to every linked customer for "all"', () => {
    expect(selectAudience('all', input)).toEqual(input.customerIds);
  });

  it('picks customers with something due soon or overdue', () => {
    expect(selectAudience('due_soon', input)).toEqual(['due-soon', 'overdue', 'override', 'shop-ahead']);
  });

  it('ignores vehicles of people who are not linked', () => {
    expect(selectAudience('due_soon', input)).not.toContain('stranger');
    expect(selectAudience('all', { ...input, customerIds: [] })).toEqual([]);
  });

  it('lists each customer once', () => {
    const twoCars = {
      ...input,
      customerIds: ['due-soon', 'due-soon'],
      vehicles: [...input.vehicles, { id: 'v-due-soon-2', userId: 'due-soon', powertrain: 'gas' as const, odometerKm: 1 }],
      records: [...input.records, record('r8', 'v-due-soon-2', '2024-01-01', 0)],
    };
    expect(selectAudience('due_soon', twoCars)).toEqual(['due-soon']);
    expect(selectAudience('all', twoCars)).toEqual(['due-soon']);
  });
});

describe('push targets and messages', () => {
  it('recognises Expo push tokens', () => {
    expect(isExpoPushToken('ExponentPushToken[abc123]')).toBe(true);
    expect(isExpoPushToken('ExpoPushToken[abc123]')).toBe(true);
    expect(isExpoPushToken('abc123')).toBe(false);
    expect(isExpoPushToken('ExponentPushToken[]')).toBe(false);
  });

  it("takes the recipients' valid tokens once each", () => {
    const tokens = [
      { token: 'ExponentPushToken[a1]', userId: 'a' },
      { token: 'ExponentPushToken[a2]', userId: 'a' },
      { token: 'ExponentPushToken[a1]', userId: 'a' },
      { token: 'ExponentPushToken[b1]', userId: 'b' },
      { token: 'garbage', userId: 'a' },
    ];
    expect(pushTargets(['a'], tokens)).toEqual(['ExponentPushToken[a1]', 'ExponentPushToken[a2]']);
    expect(pushTargets([], tokens)).toEqual([]);
  });

  it('marks messages as a campaign so the app opens its home tab', () => {
    expect(buildPushMessages(['ExponentPushToken[a]'], { id: 'c1', title: 'Hi', body: 'There' })).toEqual([
      { to: 'ExponentPushToken[a]', title: 'Hi', body: 'There', sound: 'default', data: { type: 'campaign', campaignId: 'c1' } },
    ]);
  });
});

describe('batching', () => {
  it('splits into batches of 100', () => {
    const items = Array.from({ length: 250 }, (_, i) => i);
    const batches = chunk(items);
    expect(batches.map((batch) => batch.length)).toEqual([100, 100, 50]);
    expect(batches.flat()).toEqual(items);
    expect(chunk([])).toEqual([]);
    expect(chunk(items.slice(0, 100))).toHaveLength(1);
  });

  it('counts tickets and finds tokens that no longer reach a phone', () => {
    const tokens = ['t1', 't2', 't3', 't4'];
    const tickets: ExpoPushTicket[] = [
      { status: 'ok', id: 'x' },
      { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } },
      { status: 'error', message: 'slow down', details: { error: 'MessageRateExceeded' } },
    ];
    expect(tallyBatch(tokens, tickets)).toEqual({
      sent: 1,
      failed: 3,
      failures: [
        { token: 't2', error: 'DeviceNotRegistered', message: 'gone' },
        { token: 't3', error: 'MessageRateExceeded', message: 'slow down' },
        { token: 't4', error: 'Unknown', message: null },
      ],
      deadTokens: ['t2'],
    });
  });

  it('fails the whole batch when the request fails', () => {
    expect(tallyBatch(['t1', 't2'], null, 'HTTP 503')).toEqual({
      sent: 0,
      failed: 2,
      failures: [
        { token: 't1', error: 'RequestFailed', message: 'HTTP 503' },
        { token: 't2', error: 'RequestFailed', message: 'HTTP 503' },
      ],
      deadTokens: [],
    });
  });

  it('adds up batches', () => {
    const merged = mergeBatches([
      tallyBatch(['a'], [{ status: 'ok', id: '1' }]),
      tallyBatch(['b'], [{ status: 'error', details: { error: 'DeviceNotRegistered' } }]),
    ]);
    expect(merged).toMatchObject({ sent: 1, failed: 1, deadTokens: ['b'] });
  });
});
