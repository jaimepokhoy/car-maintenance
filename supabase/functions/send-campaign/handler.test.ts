// Run with `deno test` from this folder (or `npx deno test` without a Deno install).
import { assertEquals } from '@std/assert';

import type { ExpoPushMessage, ExpoPushTicket, SentCampaign } from '../../../src/domain/campaigns.ts';
import { type CampaignStore, type DueInputs, type FailureLogEntry, createHandler, deliver } from './handler.ts';

const TENANT = 'aaaaaaaa-0000-0000-0000-000000000000';
const NOW = new Date('2026-10-22T15:00:00Z');

/** An in-memory shop: staff, linked customers, their cars and phones. */
function fakeStore(overrides: Partial<{ campaigns: SentCampaign[]; tokens: { token: string; userId: string }[] }> = {}) {
  const state = {
    staff: new Set(['staff-1']),
    linked: ['due', 'fine', 'no-phone'],
    due: {
      vehicles: [
        { id: 'v-due', userId: 'due', powertrain: 'gas', odometerKm: 52_000 },
        { id: 'v-fine', userId: 'fine', powertrain: 'gas', odometerKm: 50_500 },
        { id: 'v-no-phone', userId: 'no-phone', powertrain: 'gas', odometerKm: 90_000 },
      ],
      records: [
        { id: 'r1', vehicleId: 'v-due', itemIds: ['oil_change'], performedOn: '2026-05-01', odometerKm: 50_000 },
        { id: 'r2', vehicleId: 'v-fine', itemIds: ['oil_change'], performedOn: '2026-10-01', odometerKm: 50_000 },
        { id: 'r3', vehicleId: 'v-no-phone', itemIds: ['oil_change'], performedOn: '2024-01-01', odometerKm: 50_000 },
      ],
      intervals: [],
    } as DueInputs,
    tokens: overrides.tokens ?? [
      { token: 'ExponentPushToken[due-1]', userId: 'due' },
      { token: 'ExponentPushToken[due-2]', userId: 'due' },
      { token: 'ExponentPushToken[fine-1]', userId: 'fine' },
    ],
    campaigns: overrides.campaigns ?? ([] as SentCampaign[]),
    started: [] as { recipientCount: number; title: string }[],
    finished: [] as { sent: number; failed: number }[],
    failures: [] as FailureLogEntry[],
    deleted: [] as string[],
    ids: new Set<string>(),
  };
  const store: CampaignStore = {
    userForToken: (jwt) => Promise.resolve(jwt === 'staff-jwt' ? 'staff-1' : jwt === 'customer-jwt' ? 'due' : null),
    isStaff: (tenantId, userId) => Promise.resolve(tenantId === TENANT && state.staff.has(userId)),
    linkedCustomerIds: () => Promise.resolve(state.linked),
    dueInputs: () => Promise.resolve(state.due),
    pushTokens: (_tenantId, userIds) => Promise.resolve(state.tokens.filter((row) => userIds.includes(row.userId))),
    sentCampaigns: () => Promise.resolve(state.campaigns),
    startCampaign: ({ id, campaign, recipientCount }) => {
      if (state.ids.has(id)) return Promise.resolve('duplicate' as const);
      const counted = state.campaigns.filter((c) => c.sentCount === null || c.sentCount > 0).length;
      if (counted >= 4) return Promise.resolve('rate_limited' as const);
      state.ids.add(id);
      state.campaigns.push({ sentAt: NOW.toISOString(), sentCount: null });
      state.started.push({ recipientCount, title: campaign.title });
      return Promise.resolve('started' as const);
    },
    recordProgress: (_id, counts) => {
      state.finished.push(counts);
      return Promise.resolve();
    },
    logFailures: (_id, _tenant, failures) => {
      state.failures.push(...failures);
      return Promise.resolve();
    },
    deleteTokens: (tokens) => {
      state.deleted.push(...tokens);
      return Promise.resolve();
    },
  };
  return { state, store };
}

const quiet = { error: () => {}, info: () => {} };

function okSender(sentBatches: ExpoPushMessage[][] = []) {
  return (messages: ExpoPushMessage[]) => {
    sentBatches.push(messages);
    return Promise.resolve({ tickets: messages.map((_, i): ExpoPushTicket => ({ status: 'ok', id: `t${i}` })) });
  };
}

function request(body: unknown, jwt = 'staff-jwt') {
  return new Request('http://localhost/send-campaign', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const campaign = { tenantId: TENANT, title: 'Winter tires', body: 'Book your swap before the snow.' };
let nextId = 0;
/** A fresh campaign id, as the portal generates one per preview. */
const id = () => `cccccccc-0000-0000-0000-${String(++nextId).padStart(12, '0')}`;

Deno.test('rejects callers who are not signed in or not staff of the shop', async () => {
  const { store } = fakeStore();
  const handle = createHandler({ store, sendPush: okSender(), now: () => NOW, log: quiet });

  assertEquals((await handle(request({ ...campaign, audience: 'all' }, 'bad-jwt'))).status, 401);
  assertEquals(
    (await handle(new Request('http://localhost', { method: 'POST', body: '{}' }))).status,
    401,
  );
  assertEquals((await handle(request({ ...campaign, audience: 'all', campaignId: id() }, 'customer-jwt'))).status, 403);
  assertEquals((await handle(request({ ...campaign, audience: 'all', dryRun: true }, 'customer-jwt'))).status, 403);
  assertEquals(
    (await handle(request({ ...campaign, tenantId: 'bbbbbbbb-0000-0000-0000-000000000000', audience: 'all', dryRun: true })))
      .status,
    403,
  );
});

Deno.test('rejects an invalid campaign', async () => {
  const { store } = fakeStore();
  const handle = createHandler({ store, sendPush: okSender(), now: () => NOW, log: quiet });

  const response = await handle(request({ tenantId: TENANT, title: '', body: 'x', audience: 'everyone' }));
  assertEquals(response.status, 400);
  assertEquals(await response.json(), { error: 'invalid_campaign', fields: { title: 'required', audience: 'invalid' } });
  assertEquals((await handle(request({ ...campaign, tenantId: 'nope', audience: 'all' }))).status, 400);
});

Deno.test('a dry run counts recipients and sends nothing', async () => {
  const { store, state } = fakeStore({ campaigns: [{ sentAt: '2026-10-20T00:00:00Z', sentCount: 5 }] });
  const batches: ExpoPushMessage[][] = [];
  const handle = createHandler({ store, sendPush: okSender(batches), now: () => NOW, log: quiet });

  const all = await handle(request({ ...campaign, audience: 'all', dryRun: true }));
  assertEquals(await all.json(), {
    dryRun: true,
    customers: 3,
    devices: 3,
    allowance: { remaining: 3, nextAvailableAt: null },
  });

  // "fine" had an oil change three weeks ago; "no-phone" is overdue but has no phone.
  const dueSoon = await handle(request({ ...campaign, audience: 'due_soon', dryRun: true }));
  assertEquals(await dueSoon.json(), {
    dryRun: true,
    customers: 2,
    devices: 2,
    allowance: { remaining: 3, nextAvailableAt: null },
  });

  assertEquals(batches, []);
  assertEquals(state.started, []);
});

Deno.test('sends to the audience and records the counts', async () => {
  const { store, state } = fakeStore();
  const batches: ExpoPushMessage[][] = [];
  const handle = createHandler({ store, sendPush: okSender(batches), now: () => NOW, log: quiet });

  const campaignId = id();
  const response = await handle(request({ ...campaign, audience: 'due_soon', campaignId }));
  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    dryRun: false,
    campaignId,
    customers: 2,
    devices: 2,
    sent: 2,
    failed: 0,
  });
  assertEquals(
    batches.flat().map((m) => m.to),
    ['ExponentPushToken[due-1]', 'ExponentPushToken[due-2]'],
  );
  assertEquals(batches[0][0].data, { type: 'campaign', campaignId });
  assertEquals(batches[0][0].channelId, 'shop-messages');
  assertEquals(state.started, [{ recipientCount: 2, title: 'Winter tires' }]);
  assertEquals(state.finished, [{ sent: 2, failed: 0 }]);
});

Deno.test('does not use up a send when nobody would get it', async () => {
  const { store, state } = fakeStore({ tokens: [] });
  const handle = createHandler({ store, sendPush: okSender(), now: () => NOW, log: quiet });

  const response = await handle(request({ ...campaign, audience: 'all', campaignId: id() }));
  assertEquals(response.status, 422);
  assertEquals(state.started, []);
});

Deno.test('allows four campaigns per 30 days', async () => {
  const { store, state } = fakeStore();
  const batches: ExpoPushMessage[][] = [];
  const handle = createHandler({ store, sendPush: okSender(batches), now: () => NOW, log: quiet });

  for (let i = 0; i < 4; i++) assertEquals((await handle(request({ ...campaign, audience: 'all', campaignId: id() }))).status, 200);
  const fifth = await handle(request({ ...campaign, audience: 'all', campaignId: id() }));
  assertEquals(fifth.status, 429);
  const body = await fifth.json();
  assertEquals(body.error, 'rate_limited');
  assertEquals(body.allowance.remaining, 0);
  assertEquals(body.allowance.nextAvailableAt, '2026-11-21T15:00:00.000Z');
  assertEquals(state.started.length, 4);
  assertEquals(batches.length, 4);
});

Deno.test('logs failures and removes tokens of uninstalled apps', async () => {
  const { store, state } = fakeStore();
  const sendPush = (messages: ExpoPushMessage[]) =>
    Promise.resolve({
      tickets: messages.map((m): ExpoPushTicket =>
        m.to === 'ExponentPushToken[due-2]'
          ? { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } }
          : { status: 'ok', id: m.to },
      ),
    });
  const handle = createHandler({ store, sendPush, now: () => NOW, log: quiet });

  const response = await handle(request({ ...campaign, audience: 'all', campaignId: id() }));
  assertEquals((await response.json()).failed, 1);
  assertEquals(state.finished, [{ sent: 2, failed: 1 }]);
  assertEquals(state.failures, [{ userId: 'due', error: 'DeviceNotRegistered', message: 'not registered' }]);
  assertEquals(state.deleted, ['ExponentPushToken[due-2]']);
});

Deno.test('sends a preview only once', async () => {
  const { store, state } = fakeStore();
  const batches: ExpoPushMessage[][] = [];
  const handle = createHandler({ store, sendPush: okSender(batches), now: () => NOW, log: quiet });

  const campaignId = id();
  assertEquals((await handle(request({ ...campaign, audience: 'all', campaignId }))).status, 200);
  const again = await handle(request({ ...campaign, audience: 'all', campaignId }));
  assertEquals(again.status, 409);
  assertEquals(await again.json(), { error: 'already_sent', campaignId });
  assertEquals(batches.length, 1);
  assertEquals(state.started.length, 1);

  // A send without an id is refused before anything happens.
  assertEquals((await handle(request({ ...campaign, audience: 'all' }))).status, 400);
});

Deno.test('reports a send as done even when bookkeeping fails afterwards', async () => {
  const { store, state } = fakeStore();
  store.recordProgress = () => Promise.reject(new Error('db down'));
  store.logFailures = () => Promise.reject(new Error('db down'));
  store.deleteTokens = () => Promise.reject(new Error('db down'));
  const sendPush = (messages: ExpoPushMessage[]) =>
    Promise.resolve({
      tickets: messages.map((): ExpoPushTicket => ({ status: 'error', details: { error: 'DeviceNotRegistered' } })),
    });
  const handle = createHandler({ store, sendPush, now: () => NOW, log: quiet });

  const response = await handle(request({ ...campaign, audience: 'all', campaignId: id() }));
  assertEquals(response.status, 200);
  assertEquals((await response.json()).failed, 3);
  assertEquals(state.started.length, 1);
});

Deno.test('delivers in batches of 100 and keeps going when one batch fails', async () => {
  const tokens = Array.from({ length: 250 }, (_, i) => `ExponentPushToken[${i}]`);
  const sizes: number[] = [];
  let call = 0;
  const progress: { sent: number; failed: number }[] = [];
  const onProgress = (counts: { sent: number; failed: number }) => Promise.resolve(progress.push(counts));
  const result = await deliver(tokens, { id: 'c', title: 'T', body: 'B' }, (messages) => {
    sizes.push(messages.length);
    call += 1;
    if (call === 2) return Promise.reject(new Error('socket hang up'));
    return Promise.resolve({ tickets: messages.map((): ExpoPushTicket => ({ status: 'ok', id: 'x' })) });
  }, onProgress);
  assertEquals(sizes, [100, 100, 50]);
  assertEquals(progress, [
    { sent: 100, failed: 0 },
    { sent: 100, failed: 100 },
    { sent: 150, failed: 100 },
  ]);
  assertEquals(result.sent, 150);
  assertEquals(result.failed, 100);
  assertEquals(result.failures[0], { token: 'ExponentPushToken[100]', error: 'RequestFailed', message: 'socket hang up' });
});
