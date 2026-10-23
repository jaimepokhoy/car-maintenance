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

/** iOS shows about this much of a title on the lock screen. */
export const CAMPAIGN_TITLE_MAX = 65;
export const CAMPAIGN_BODY_MAX = 240;

/** A shop can send this many campaigns in any rolling window of `CAMPAIGN_WINDOW_DAYS`. */
export const CAMPAIGN_LIMIT = 4;
export const CAMPAIGN_WINDOW_DAYS = 30;

/** The Expo Push API takes at most 100 messages per request. */
export const PUSH_BATCH_SIZE = 100;

export interface CampaignDraft {
  title: string;
  body: string;
  audience: CampaignAudience;
}

export type CampaignField = keyof CampaignDraft;
export type CampaignError = 'required' | 'tooLong' | 'invalid';

export type CampaignValidation =
  | { ok: true; campaign: CampaignDraft }
  | { ok: false; errors: Partial<Record<CampaignField, CampaignError>> };

/** Trims and checks a campaign before it is previewed or sent. */
export function validateCampaign(input: { title?: unknown; body?: unknown; audience?: unknown }): CampaignValidation {
  const errors: Partial<Record<CampaignField, CampaignError>> = {};
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  const audience = input.audience;

  if (!title) errors.title = 'required';
  else if (title.length > CAMPAIGN_TITLE_MAX) errors.title = 'tooLong';
  if (!body) errors.body = 'required';
  else if (body.length > CAMPAIGN_BODY_MAX) errors.body = 'tooLong';
  if (!CAMPAIGN_AUDIENCES.includes(audience as CampaignAudience)) errors.audience = 'invalid';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, campaign: { title, body, audience: audience as CampaignAudience } };
}

/** A campaign already sent, as the rate limit sees it. */
export interface SentCampaign {
  /** ISO timestamp. */
  sentAt: string;
  /** Null while it is still sending. */
  sentCount: number | null;
}

export interface CampaignAllowance {
  remaining: number;
  /** When the next send frees up (ISO timestamp), or null if one is free now. */
  nextAvailableAt: string | null;
}

const WINDOW_MS = CAMPAIGN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/**
 * How many campaigns the shop can still send. A campaign counts for
 * `CAMPAIGN_WINDOW_DAYS` after it was sent, unless it reached nobody (every
 * delivery failed), so an Expo outage doesn't cost the shop a send. The
 * database enforces the same rule when a send starts (`start_campaign`).
 */
export function campaignAllowance(sent: SentCampaign[], now: Date): CampaignAllowance {
  const since = now.getTime() - WINDOW_MS;
  const counted = sent
    .filter((campaign) => campaign.sentCount === null || campaign.sentCount > 0)
    .map((campaign) => Date.parse(campaign.sentAt))
    .filter((time) => time > since)
    .sort((a, b) => a - b);
  const remaining = Math.max(0, CAMPAIGN_LIMIT - counted.length);
  if (remaining > 0) return { remaining, nextAvailableAt: null };
  // The oldest send that has to expire before the count drops below the limit.
  const freesUp = counted[counted.length - CAMPAIGN_LIMIT] + WINDOW_MS;
  return { remaining, nextAvailableAt: new Date(freesUp).toISOString() };
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
  const due = new Set<string>();
  for (const vehicle of input.vehicles) {
    if (!linked.has(vehicle.userId) || due.has(vehicle.userId)) continue;
    const records = input.records.filter((record) => record.vehicleId === vehicle.id);
    const overrides = input.intervals.filter((interval) => interval.vehicleId === vehicle.id);
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

export interface PushTokenRow {
  token: string;
  userId: string;
}

export function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);
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
      result.failures.push({ token, error: 'RequestFailed', message: requestError ?? null });
      return;
    }
    const error = ticket?.details?.error ?? 'Unknown';
    result.failures.push({ token, error, message: ticket?.message ?? null });
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
