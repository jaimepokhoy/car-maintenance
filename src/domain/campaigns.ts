/**
 * Rules for shop campaigns: reminders and promotions a shop sends as push
 * notifications to its linked customers. Shared by the portal (compose and
 * preview) and the `send-campaign` Edge Function (who gets it, batching, rate
 * limit), so both agree.
 */
import { computeVehicleDueStatuses } from './due-status';
import { resolveSchedule } from './schedules';
import type { IsoDate, MaintenanceInterval, Powertrain, ServiceRecord } from './types';

export type CampaignAudience = 'all' | 'due_soon';

export const CAMPAIGN_AUDIENCES: readonly CampaignAudience[] = ['all', 'due_soon'];

/**
 * What a campaign is for. A promotion is a commercial message, so it only goes
 * to customers who opted in to the shop's promotions (`eligibleCustomers`).
 */
export type CampaignKind = 'service_reminder' | 'promotion';

export const CAMPAIGN_KINDS: readonly CampaignKind[] = ['service_reminder', 'promotion'];

/** iOS shows about this much of a title on the lock screen. */
export const CAMPAIGN_TITLE_MAX = 65;
export const CAMPAIGN_BODY_MAX = 240;

/** A shop can send this many campaigns in any rolling window of `CAMPAIGN_WINDOW_DAYS`. */
export const CAMPAIGN_LIMIT = 4;
export const CAMPAIGN_WINDOW_DAYS = 30;

/** Android notification channel the app creates for shop messages, so owners can mute them separately. */
export const SHOP_CHANNEL_ID = 'shop-messages';

/** The Expo Push API takes at most 100 messages per request. */
export const PUSH_BATCH_SIZE = 100;

export interface CampaignDraft {
  title: string;
  body: string;
  audience: CampaignAudience;
  kind: CampaignKind;
}

export type CampaignField = keyof CampaignDraft;
export type CampaignError = 'required' | 'tooLong' | 'invalid';

export type CampaignValidation =
  | { ok: true; campaign: CampaignDraft }
  | { ok: false; errors: Partial<Record<CampaignField, CampaignError>> };

/** Trims and checks a campaign before it is previewed or sent. */
export function validateCampaign(input: {
  title?: unknown;
  body?: unknown;
  audience?: unknown;
  kind?: unknown;
}): CampaignValidation {
  const errors: Partial<Record<CampaignField, CampaignError>> = {};
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  const { audience, kind } = input;

  if (!title) errors.title = 'required';
  else if (title.length > CAMPAIGN_TITLE_MAX) errors.title = 'tooLong';
  if (!body) errors.body = 'required';
  else if (body.length > CAMPAIGN_BODY_MAX) errors.body = 'tooLong';
  if (!CAMPAIGN_AUDIENCES.includes(audience as CampaignAudience)) errors.audience = 'invalid';
  // No default: staff choose, so a promotion never goes out as a reminder by accident.
  if (kind === undefined || kind === null || kind === '') errors.kind = 'required';
  else if (!CAMPAIGN_KINDS.includes(kind as CampaignKind)) errors.kind = 'invalid';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    campaign: { title, body, audience: audience as CampaignAudience, kind: kind as CampaignKind },
  };
}

/** A campaign already sent, as the rate limit sees it. */
export interface SentCampaign {
  /** ISO timestamp. */
  sentAt: string;
  /** Null until the first batch has gone out. */
  sentCount: number | null;
}

export interface CampaignAllowance {
  remaining: number;
  /** When the next send frees up (ISO timestamp), or null if one is free now. */
  nextAvailableAt: string | null;
}

const HOUR_MS = 60 * 60 * 1000;
export const CAMPAIGN_WINDOW_HOURS = CAMPAIGN_WINDOW_DAYS * 24;
const WINDOW_MS = CAMPAIGN_WINDOW_HOURS * HOUR_MS;

/**
 * A send that reported no progress for this long stopped before its first
 * batch (the function was killed), so it reached nobody.
 */
export const CAMPAIGN_STALE_MINUTES = 15;
const STALE_MS = CAMPAIGN_STALE_MINUTES * 60 * 1000;

/** True when a campaign's send stopped before anything went out. */
export function isUnfinishedSend(campaign: SentCampaign, now: Date): boolean {
  return campaign.sentCount === null && Date.parse(campaign.sentAt) <= now.getTime() - STALE_MS;
}

/**
 * How many campaigns the shop can still send. A campaign counts for
 * `CAMPAIGN_WINDOW_DAYS` after it was sent, unless it reached nobody (every
 * delivery failed, or the send stopped before its first batch), so an Expo
 * outage doesn't cost the shop a send. The database enforces the same rule
 * when a send starts (`start_campaign`).
 */
export function campaignAllowance(sent: SentCampaign[], now: Date): CampaignAllowance {
  const since = now.getTime() - WINDOW_MS;
  const counted = sent
    .filter((campaign) => (campaign.sentCount === null ? !isUnfinishedSend(campaign, now) : campaign.sentCount > 0))
    .map((campaign) => Date.parse(campaign.sentAt))
    .filter((time) => time > since)
    .sort((a, b) => a - b);
  const remaining = Math.max(0, CAMPAIGN_LIMIT - counted.length);
  if (remaining > 0) return { remaining, nextAvailableAt: null };
  // The oldest send that has to expire before the count drops below the limit.
  const freesUp = counted[counted.length - CAMPAIGN_LIMIT] + WINDOW_MS;
  return { remaining, nextAvailableAt: new Date(freesUp).toISOString() };
}

/** A customer with a live link to the shop. */
export interface LinkedCustomer {
  id: string;
  /** True when they opted in to the shop's promotions (`customer_links.promotions_opt_in_at`). */
  promotionsOptIn: boolean;
}

/**
 * The linked customers a campaign of this kind may go to: all of them for a
 * service reminder, only those who opted in for a promotion.
 */
export function eligibleCustomers(kind: CampaignKind, customers: LinkedCustomer[]): string[] {
  return customers
    .filter((customer) => kind === 'service_reminder' || customer.promotionsOptIn)
    .map((customer) => customer.id);
}

export interface AudienceVehicle {
  id: string;
  userId: string;
  powertrain: Powertrain;
  odometerKm: number;
}

/** A per-vehicle schedule override (`maintenance_intervals`). */
export interface AudienceInterval extends MaintenanceInterval {
  vehicleId: string;
}

export interface AudienceInput {
  /** The shop's linked, non-revoked customers. */
  customerIds: string[];
  vehicles: AudienceVehicle[];
  records: ServiceRecord[];
  intervals: AudienceInterval[];
  today: IsoDate;
}

/**
 * The customers a campaign goes to. `due_soon` means at least one vehicle with
 * an item due soon or overdue, worked out exactly as the app and the portal's
 * customer list do. Vehicles of anyone not in `customerIds` are ignored.
 */
export function selectAudience(audience: CampaignAudience, input: AudienceInput): string[] {
  const customers = [...new Set(input.customerIds)];
  if (audience === 'all') return customers;

  const linked = new Set(customers);
  const recordsByVehicle = groupBy(input.records, (record) => record.vehicleId);
  const intervalsByVehicle = groupBy(input.intervals, (interval) => interval.vehicleId);
  const due = new Set<string>();
  for (const vehicle of input.vehicles) {
    if (!linked.has(vehicle.userId) || due.has(vehicle.userId)) continue;
    const records = recordsByVehicle.get(vehicle.id) ?? [];
    const overrides = intervalsByVehicle.get(vehicle.id) ?? [];
    // A shop's record can be ahead of the vehicle row until the owner's app syncs.
    const odometerKm = Math.max(vehicle.odometerKm, ...records.map((record) => record.odometerKm));
    const statuses = computeVehicleDueStatuses(
      resolveSchedule(vehicle.powertrain, overrides.map(({ itemId, everyKm, everyMonths }) => ({ itemId, everyKm, everyMonths }))),
      { id: vehicle.id, odometerKm },
      records,
      input.today,
    );
    if (statuses.some((status) => status.state === 'overdue' || status.state === 'due_soon')) due.add(vehicle.userId);
  }
  return customers.filter((id) => due.has(id));
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const list = out.get(key(row));
    if (list) list.push(row);
    else out.set(key(row), [row]);
  }
  return out;
}

export interface PushTokenRow {
  token: string;
  userId: string;
}

export function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);
}

/** Removes push tokens from text, such as Expo's error messages, before staff can read it. */
export function redactPushTokens(text: string): string {
  return text.replace(/Expo(nent)?PushToken\[[^\]]*\]/g, '[token]');
}

/** The recipients' valid Expo push tokens, once each. */
export function pushTargets(recipientIds: string[], tokens: PushTokenRow[]): string[] {
  const recipients = new Set(recipientIds);
  const out = new Set<string>();
  for (const row of tokens) {
    if (recipients.has(row.userId) && isExpoPushToken(row.token)) out.add(row.token);
  }
  return [...out];
}

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  channelId: typeof SHOP_CHANNEL_ID;
  /** The app opens its home tab for `type: "campaign"` (see `push.ts`). */
  data: { type: 'campaign'; campaignId: string };
}

export function buildPushMessages(
  tokens: string[],
  campaign: { id: string; title: string; body: string },
): ExpoPushMessage[] {
  return tokens.map((to) => ({
    to,
    title: campaign.title,
    body: campaign.body,
    sound: 'default',
    channelId: SHOP_CHANNEL_ID,
    data: { type: 'campaign', campaignId: campaign.id },
  }));
}

export function chunk<T>(items: T[], size: number = PUSH_BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** One entry of the Expo Push API's `data` array, in the order the messages were sent. */
export type ExpoPushTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message?: string; details?: { error?: string } };

export interface PushFailure {
  token: string;
  /** Expo's error code (`DeviceNotRegistered`, …) or `RequestFailed` when the whole batch failed. */
  error: string;
  message: string | null;
}

export interface BatchResult {
  sent: number;
  failed: number;
  failures: PushFailure[];
  /** Tokens Expo says no longer reach a device; delete them. */
  deadTokens: string[];
}

/**
 * Reads the tickets for one batch. `tickets` is null when the request itself
 * failed, in which case every message in the batch counts as failed. A
 * missing ticket also counts as a failure.
 */
export function tallyBatch(tokens: string[], tickets: ExpoPushTicket[] | null, requestError?: string): BatchResult {
  const result: BatchResult = { sent: 0, failed: 0, failures: [], deadTokens: [] };
  tokens.forEach((token, i) => {
    const ticket = tickets?.[i];
    if (ticket?.status === 'ok') {
      result.sent += 1;
      return;
    }
    result.failed += 1;
    if (!tickets) {
      result.failures.push({ token, error: 'RequestFailed', message: requestError ? redactPushTokens(requestError) : null });
      return;
    }
    const error = ticket?.details?.error ?? 'Unknown';
    result.failures.push({ token, error, message: ticket?.message ? redactPushTokens(ticket.message) : null });
    if (error === 'DeviceNotRegistered') result.deadTokens.push(token);
  });
  return result;
}

export function mergeBatches(results: BatchResult[]): BatchResult {
  return {
    sent: results.reduce((sum, r) => sum + r.sent, 0),
    failed: results.reduce((sum, r) => sum + r.failed, 0),
    failures: results.flatMap((r) => r.failures),
    deadTokens: results.flatMap((r) => r.deadTokens),
  };
}
