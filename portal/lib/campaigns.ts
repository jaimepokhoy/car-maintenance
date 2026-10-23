import {
  type CampaignAllowance,
  type CampaignDraft,
  type CampaignError,
  type CampaignField,
  campaignAllowance,
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
  | { status: 'preview'; draft: CampaignDraft; customers: number; devices: number; allowance: CampaignAllowance }
  | { status: 'sent'; customers: number; devices: number; sent: number; failed: number }
  | { status: 'noRecipients'; draft: CampaignDraft }
  | { status: 'rateLimited'; draft: CampaignDraft; nextAvailableAt: string | null }
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
export function toMessageState(status: number, body: unknown, draft: CampaignDraft): MessageState {
  const reply = (body ?? {}) as Record<string, unknown>;
  const count = (key: string) => (typeof reply[key] === 'number' ? (reply[key] as number) : 0);

  if (status === 200 && reply.dryRun === true && isAllowance(reply.allowance)) {
    return { status: 'preview', draft, customers: count('customers'), devices: count('devices'), allowance: reply.allowance };
  }
  if (status === 200 && reply.dryRun === false) {
    return { status: 'sent', customers: count('customers'), devices: count('devices'), sent: count('sent'), failed: count('failed') };
  }
  if (status === 422 && reply.error === 'no_recipients') return { status: 'noRecipients', draft };
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

/** Sends left this month, from the shop's recent campaigns. */
export function allowanceFromHistory(rows: CampaignRow[], now: Date = new Date()): CampaignAllowance {
  return campaignAllowance(
    rows.map((row) => ({ sentAt: row.sent_at, sentCount: row.sent_count })),
    now,
  );
}
