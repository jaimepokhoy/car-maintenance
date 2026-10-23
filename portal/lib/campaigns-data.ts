import 'server-only';

import { CAMPAIGN_COLUMNS, type CampaignRow, allowanceFromHistory } from './campaigns';
import { CAMPAIGN_WINDOW_DAYS, type CampaignAllowance } from './domain';
import type { createClient } from './supabase/server';

type Client = NonNullable<Awaited<ReturnType<typeof createClient>>>;

/** How many past campaigns the Messages page lists. */
const HISTORY_SIZE = 20;

export type MessagesPageData = {
  shopName: string;
  allowance: CampaignAllowance;
  /** Newest first; null when it could not be loaded. */
  history: CampaignRow[] | null;
};

/**
 * The shop's name, sends left and recent campaigns, read as the signed-in
 * staff member. Null when the shop isn't theirs.
 */
export async function loadMessagesPage(supabase: Client, tenantId: string, now: Date = new Date()): Promise<MessagesPageData | null> {
  const since = new Date(now.getTime() - CAMPAIGN_WINDOW_DAYS * 86_400_000).toISOString();
  const [{ data: tenant }, recent, history] = await Promise.all([
    supabase.from('tenants').select('name').eq('id', tenantId).maybeSingle<{ name: string }>(),
    supabase
      .from('campaigns')
      .select(CAMPAIGN_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('status', 'sent')
      .gt('sent_at', since)
      .returns<CampaignRow[]>(),
    supabase
      .from('campaigns')
      .select(CAMPAIGN_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('status', 'sent')
      .order('sent_at', { ascending: false })
      .limit(HISTORY_SIZE)
      .returns<CampaignRow[]>(),
  ]);
  if (!tenant) return null;
  return {
    shopName: tenant.name,
    allowance: allowanceFromHistory(recent.data ?? [], now),
    history: history.error ? null : (history.data ?? []),
  };
}
