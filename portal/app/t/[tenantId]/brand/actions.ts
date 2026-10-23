'use server';

import { revalidatePath } from 'next/cache';

import { type Brand, type BrandError, type BrandField, parseBrandForm, tenantAssetsPrefix } from '@/lib/brand';
import { supabaseEnv } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

export type SaveState =
  | { status: 'idle' }
  | { status: 'saved' }
  | { status: 'invalid'; errors: Partial<Record<BrandField, BrandError>> }
  | { status: 'failed' };

/** Saves the Brand form to `tenants`. RLS limits the update to the user's own shops. */
export async function saveBrand(tenantId: string, _previous: SaveState, form: FormData): Promise<SaveState> {
  const env = supabaseEnv();
  const supabase = await createClient();
  if (!env || !supabase) return { status: 'failed' };

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, brand')
    .eq('id', tenantId)
    .maybeSingle<{ id: string; brand: Brand }>();
  if (!tenant) return { status: 'failed' };

  // The stored id, not the URL segment: uploads use it as the folder name.
  const parsed = parseBrandForm(form, tenant.brand ?? {}, tenantAssetsPrefix(env.url, tenant.id));
  if (!parsed.ok) return { status: 'invalid', errors: parsed.errors };

  const { data, error } = await supabase.from('tenants').update(parsed.update).eq('id', tenantId).select('id');
  if (error || !data?.length) return { status: 'failed' };

  revalidatePath(`/t/${tenantId}/brand`);
  return { status: 'saved' };
}
