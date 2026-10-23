import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Names of active shops by id, from the public `tenant_profiles` view. A
 * suspended shop isn't in the view, so it is simply left out.
 */
export async function fetchTenantNames(
  client: SupabaseClient,
  ids: readonly string[],
): Promise<{ id: string; name: string }[]> {
  if (ids.length === 0) return [];
  const { data, error } = await client.from('tenant_profiles').select('id, name').in('id', ids);
  if (error) throw error;
  return ((data ?? []) as { id?: unknown; name?: unknown }[]).flatMap((row) =>
    typeof row.id === 'string' && typeof row.name === 'string' ? [{ id: row.id, name: row.name }] : [],
  );
}
