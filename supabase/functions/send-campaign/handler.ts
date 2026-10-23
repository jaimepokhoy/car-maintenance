/**
 * The send-campaign request flow, with every outside call injected so it can
 * be tested without Supabase or Expo (see handler.test.ts). The real
 * dependencies are wired up in index.ts.
 */
import {
  type AudienceInterval,
  type AudienceVehicle,
  type BatchResult,
  CAMPAIGN_LIMIT,
  CAMPAIGN_WINDOW_DAYS,
  type CampaignAllowance,
  type CampaignDraft,
  type ExpoPushMessage,
  type ExpoPushTicket,
  type LinkedCustomer,
  type PushTokenRow,
  type SentCampaign,
  buildPushMessages,
  campaignAllowance,
  chunk,
  eligibleCustomers,
  mergeBatches,
  pushTargets,
  selectAudience,
  tallyBatch,
  validateCampaign,
} from '../_shared/domain/campaigns.ts';
import type { ServiceRecord } from '../_shared/domain/types.ts';

export interface DueInputs {
  vehicles: AudienceVehicle[];
  records: ServiceRecord[];
  intervals: AudienceInterval[];
}

export interface FailureLogEntry {
  userId: string | null;
  error: string;
  message: string | null;
}

/** Database access, as the service role. */
export interface CampaignStore {
  /** The signed-in user behind an access token, or null when it isn't valid. */
  userForToken(jwt: string): Promise<string | null>;
  isStaff(tenantId: string, userId: string): Promise<boolean>;
  /** Users with a live (non-revoked, non-deleted) link to the shop, and whether they opted in to promotions. */
  linkedCustomers(tenantId: string): Promise<LinkedCustomer[]>;
  dueInputs(customerIds: string[]): Promise<DueInputs>;
  /** Push tokens registered from this shop's app by these users. */
  pushTokens(tenantId: string, userIds: string[]): Promise<PushTokenRow[]>;
  /** Campaigns sent since `since` (ISO timestamp). */
  sentCampaigns(tenantId: string, since: string): Promise<SentCampaign[]>;
  /**
   * Records the campaign as sent under `id` if the shop is under the limit.
   * `duplicate` when `id` was already used: the same preview sent twice.
   */
  startCampaign(input: {
    id: string;
    tenantId: string;
    campaign: CampaignDraft;
    createdBy: string;
    recipientCount: number;
  }): Promise<'started' | 'duplicate' | 'rate_limited'>;
  /** Writes the counts so far; called after each batch. */
  recordProgress(campaignId: string, counts: { sent: number; failed: number }): Promise<void>;
  logFailures(campaignId: string, tenantId: string, failures: FailureLogEntry[]): Promise<void>;
  deleteTokens(tokens: string[]): Promise<void>;
}

/** One request to the Expo Push API: tickets in message order, or why the request failed. */
export type PushSender = (messages: ExpoPushMessage[]) => Promise<{ tickets: ExpoPushTicket[] } | { error: string }>;

export interface HandlerDeps {
  store: CampaignStore;
  sendPush: PushSender;
  now?: () => Date;
  log?: Pick<Console, 'error' | 'info'>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SendCampaignResponse =
  | { dryRun: true; customers: number; devices: number; allowance: CampaignAllowance }
  | { dryRun: false; campaignId: string; customers: number; devices: number; sent: number; failed: number };

/**
 * POST { tenantId, title, body, audience, kind, dryRun?, campaignId? } with the
 * staff member's access token. A dry run returns who would get it and how
 * many sends are left, and changes nothing. A send needs `campaignId`, a
 * UUID the portal generates per preview, so the same preview can't go out
 * twice.
 */
export function createHandler({ store, sendPush, now = () => new Date(), log = console }: HandlerDeps) {
  return async function handle(req: Request): Promise<Response> {
    if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

    const jwt = req.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
    const userId = jwt ? await store.userForToken(jwt) : null;
    if (!userId) return json(401, { error: 'unauthorized' });

    let input: Record<string, unknown>;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
      input = parsed as Record<string, unknown>;
    } catch {
      return json(400, { error: 'invalid_json' });
    }

    const tenantId = input.tenantId;
    if (typeof tenantId !== 'string' || !UUID.test(tenantId)) return json(400, { error: 'invalid_tenant' });
    const validation = validateCampaign(input);
    if (!validation.ok) return json(400, { error: 'invalid_campaign', fields: validation.errors });
    const { campaign } = validation;
    const dryRun = input.dryRun === true;
    const campaignId = typeof input.campaignId === 'string' ? input.campaignId.toLowerCase() : '';
    if (!dryRun && !UUID.test(campaignId)) return json(400, { error: 'invalid_campaign_id' });

    let started = false;
    try {
      if (!(await store.isStaff(tenantId, userId))) return json(403, { error: 'forbidden' });

      // Promotions only reach customers who opted in to them.
      const customerIds = eligibleCustomers(campaign.kind, await store.linkedCustomers(tenantId));
      // Only "due soon" needs vehicles and history.
      const dueInputs: DueInputs =
        campaign.audience === 'due_soon' && customerIds.length > 0
          ? await store.dueInputs(customerIds)
          : { vehicles: [], records: [], intervals: [] };
      const recipients = selectAudience(campaign.audience, { customerIds, ...dueInputs, today: canadianToday(now()) });
      const tokenRows = recipients.length > 0 ? await store.pushTokens(tenantId, recipients) : [];
      const tokens = pushTargets(recipients, tokenRows);

      const allowance = async () => {
        const since = new Date(now().getTime() - CAMPAIGN_WINDOW_DAYS * 86_400_000).toISOString();
        return campaignAllowance(await store.sentCampaigns(tenantId, since), now());
      };

      if (dryRun) {
        return json(200, { dryRun: true, customers: recipients.length, devices: tokens.length, allowance: await allowance() });
      }

      // Don't use up one of the shop's sends on a message nobody would get.
      if (tokens.length === 0) return json(422, { error: 'no_recipients' });

      const outcome = await store.startCampaign({
        id: campaignId,
        tenantId,
        campaign,
        createdBy: userId,
        recipientCount: tokens.length,
      });
      if (outcome === 'duplicate') return json(409, { error: 'already_sent', campaignId });
      if (outcome === 'rate_limited') {
        return json(429, { error: 'rate_limited', limit: CAMPAIGN_LIMIT, allowance: await allowance() });
      }
      started = true;

      // From here on messages are going out: bookkeeping failures are logged
      // but never reported as a failed send, or staff would send it again.
      const warn = (what: string) => (error: unknown) => log.error(`send-campaign ${campaignId}: ${what}`, error);
      const result = await deliver(tokens, { id: campaignId, ...campaign }, sendPush, (counts) =>
        store.recordProgress(campaignId, counts).catch(warn('progress not saved')),
      );
      const owner = new Map(tokenRows.map((row) => [row.token, row.userId]));
      if (result.failures.length > 0) {
        log.error(`send-campaign ${campaignId}: ${result.failed} of ${tokens.length} failed`, summarize(result));
        await store
          .logFailures(
            campaignId,
            tenantId,
            result.failures.map((failure) => ({
              userId: owner.get(failure.token) ?? null,
              error: failure.error,
              message: failure.message,
            })),
          )
          .catch(warn('failures not logged'));
      }
      if (result.deadTokens.length > 0) await store.deleteTokens(result.deadTokens).catch(warn('dead tokens not removed'));
      log.info(`send-campaign ${campaignId}: sent ${result.sent}, failed ${result.failed}`);

      return json(200, {
        dryRun: false,
        campaignId,
        customers: recipients.length,
        devices: tokens.length,
        sent: result.sent,
        failed: result.failed,
      });
    } catch (error) {
      log.error('send-campaign failed', error);
      // Once started, some messages may have gone out: say so rather than invite a resend.
      return json(500, { error: started ? 'send_interrupted' : 'internal' });
    }
  };
}

/**
 * Sends in batches of 100, one request at a time, reporting the running
 * totals after each batch. A failed batch doesn't stop the rest.
 */
export async function deliver(
  tokens: string[],
  campaign: { id: string; title: string; body: string },
  sendPush: PushSender,
  onProgress: (counts: { sent: number; failed: number }) => Promise<unknown> = () => Promise.resolve(),
): Promise<BatchResult> {
  const results: BatchResult[] = [];
  for (const batch of chunk(tokens)) {
    let response: Awaited<ReturnType<PushSender>>;
    try {
      response = await sendPush(buildPushMessages(batch, campaign));
    } catch (error) {
      response = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push('tickets' in response ? tallyBatch(batch, response.tickets) : tallyBatch(batch, null, response.error));
    const { sent, failed } = mergeBatches(results);
    await onProgress({ sent, failed });
  }
  return mergeBatches(results);
}

function summarize(result: BatchResult): Record<string, number> {
  const byError: Record<string, number> = {};
  for (const failure of result.failures) byError[failure.error] = (byError[failure.error] ?? 0) + 1;
  return byError;
}

/**
 * Today's calendar date for a Canadian shop, in Newfoundland time like the
 * portal's customer list (`portal/lib/customers.ts`), so both agree on what
 * is due.
 */
export function canadianToday(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/St_Johns',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
