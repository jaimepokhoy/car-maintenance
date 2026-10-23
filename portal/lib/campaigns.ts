import {
  type CampaignAllowance,
  type CampaignDraft,
  type CampaignError,
  type CampaignField,
  campaignAllowance,
  isUnfinishedSend,
  validateCampaign,
} from './domain';

/** The `campaigns` columns the Messages page reads. */
export type CampaignRow = {
  id: string;
  title: string;
  body: string;
  audience: CampaignDraft['audience'];
  sent_at: string;
  recipient_count: number | null;
  sent_count: number | null;
  failed_count: number | null;
};

export const CAMPAIGN_COLUMNS = 'id, title, body, audience, sent_at, recipient_count, sent_count, failed_count';

export type MessageState =
  | { status: 'idle' }
  | { status: 'invalid'; draft: Partial<CampaignDraft>; errors: Partial<Record<CampaignField, CampaignError>> }
  | {
      status: 'preview';
      draft: CampaignDraft;
      /** Generated for this preview; sending it twice is refused. */
      campaignId: string;
      customers: number;
      devices: number;
      allowance: CampaignAllowance;
    }
  | { status: 'sent'; customers: number; devices: number; sent: number; failed: number }
  | { status: 'noRecipients'; draft: CampaignDraft }
  | { status: 'rateLimited'; draft: CampaignDraft; nextAvailableAt: string | null }
  | { status: 'alreadySent'; draft: CampaignDraft }
  /** The send started but didn't report back; some messages may have gone out. */
  | { status: 'interrupted'; draft: CampaignDraft }
  | { status: 'failed'; draft: CampaignDraft };

export type ParsedCampaignForm =
  | { ok: true; draft: CampaignDraft }
  | { ok: false; state: Extract<MessageState, { status: 'invalid' }> };

/** Reads and checks the compose form with the same rules the send-campaign function applies. */
export function parseCampaignForm(form: FormData): ParsedCampaignForm {
  const input = { title: form.get('title'), body: form.get('body'), audience: form.get('audience') };
  const result = validateCampaign(input);
  if (result.ok) return { ok: true, draft: result.campaign };
  const text = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value : undefined);
  const audience = text(input.audience);
  return {
    ok: false,
    state: {
      status: 'invalid',
      draft: {
        title: text(input.title),
        body: text(input.body),
        audience: audience === 'all' || audience === 'due_soon' ? audience : undefined,
      },
      errors: result.errors,
    },
  };
}

/**
 * Turns the send-campaign function's reply into what the page shows.
 * Anything unexpected is a failure the staff member can retry.
 */
export function toMessageState(status: number, body: unknown, draft: CampaignDraft, campaignId: string): MessageState {
  const reply = (body ?? {}) as Record<string, unknown>;
  const count = (key: string) => (typeof reply[key] === 'number' ? (reply[key] as number) : 0);

  if (status === 200 && reply.dryRun === true && isAllowance(reply.allowance)) {
    return {
      status: 'preview',
      draft,
      campaignId,
      customers: count('customers'),
      devices: count('devices'),
      allowance: reply.allowance,
    };
  }
  if (status === 200 && reply.dryRun === false) {
    return { status: 'sent', customers: count('customers'), devices: count('devices'), sent: count('sent'), failed: count('failed') };
  }
  if (status === 422 && reply.error === 'no_recipients') return { status: 'noRecipients', draft };
  if (status === 409 && reply.error === 'already_sent') return { status: 'alreadySent', draft };
  if (status === 500 && reply.error === 'send_interrupted') return { status: 'interrupted', draft };
  if (status === 429 && reply.error === 'rate_limited') {
    const allowance = isAllowance(reply.allowance) ? reply.allowance : null;
    return { status: 'rateLimited', draft, nextAvailableAt: allowance?.nextAvailableAt ?? null };
  }
  return { status: 'failed', draft };
}

function isAllowance(value: unknown): value is CampaignAllowance {
  const allowance = value as CampaignAllowance | null | undefined;
  return (
    typeof allowance?.remaining === 'number' &&
    (allowance.nextAvailableAt === null || typeof allowance.nextAvailableAt === 'string')
  );
}

/** True when a campaign stopped before its first batch went out. */
export function isUnfinished(row: Pick<CampaignRow, 'sent_at' | 'sent_count'>, now: Date = new Date()): boolean {
  return isUnfinishedSend({ sentAt: row.sent_at, sentCount: row.sent_count }, now);
}

/** Sends left this month, from the shop's recent campaigns. */
export function allowanceFromHistory(rows: CampaignRow[], now: Date = new Date()): CampaignAllowance {
  return campaignAllowance(
    rows.map((row) => ({ sentAt: row.sent_at, sentCount: row.sent_count })),
    now,
  );
}
