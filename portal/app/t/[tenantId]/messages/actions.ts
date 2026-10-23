'use server';

import { randomUUID } from 'node:crypto';

import { FunctionsHttpError } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

import { type MessageState, parseCampaignForm, toMessageState } from '@/lib/campaigns';
import { createClient } from '@/lib/supabase/server';

/**
 * Previews or sends a campaign through the send-campaign Edge Function, as
 * the signed-in staff member (the function checks they work at the shop).
 * The form's `intent` is `preview` (a dry run: who would get it) or `send`.
 * Each preview gets a new campaign id, and sending reuses it, so a double
 * click or a retry of the same preview can't send twice.
 */
export async function submitCampaign(tenantId: string, _previous: MessageState, form: FormData): Promise<MessageState> {
  const parsed = parseCampaignForm(form);
  if (!parsed.ok) return parsed.state;
  const { draft } = parsed;

  const supabase = await createClient();
  if (!supabase) return { status: 'failed', draft };

  const dryRun = form.get('intent') !== 'send';
  const campaignId = dryRun ? randomUUID() : String(form.get('campaignId') ?? '');
  const { data, error } = await supabase.functions.invoke('send-campaign', {
    body: { tenantId, ...draft, dryRun, campaignId },
  });

  let state: MessageState;
  if (!error) {
    state = toMessageState(200, data, draft, campaignId);
  } else if (error instanceof FunctionsHttpError) {
    const response = error.context as Response;
    state = toMessageState(response.status, await response.json().catch(() => null), draft, campaignId);
  } else {
    state = { status: 'failed', draft };
  }

  if (!dryRun) revalidatePath(`/t/${tenantId}/messages`);
  return state;
}
