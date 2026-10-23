import type { SupabaseClient } from '@supabase/supabase-js';

import { parseTenantProfile, type TenantProfile } from '@/domain/brand';

export type ProfileFetch =
  /** The shop's live profile, or null when it is missing or suspended. */
  | { ok: true; profile: TenantProfile | null }
  /** Offline or the request failed; keep whatever is cached. */
  | { ok: false };

/** Reads this shop's public profile from the `tenant_profiles` view. */
export async function fetchTenantProfile(client: SupabaseClient, slug: string): Promise<ProfileFetch> {
  try {
    const { data, error } = await client.from('tenant_profiles').select('*').eq('slug', slug).maybeSingle();
    if (error) return { ok: false };
    return { ok: true, profile: parseTenantProfile(data) };
  } catch {
    return { ok: false };
  }
}
