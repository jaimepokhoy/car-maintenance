/**
 * Supabase project URL and anon key. The portal uses only the anon key, so
 * every read and write runs as the signed-in staff member under RLS. Returns
 * null until both env vars are set, and pages show a setup message instead.
 */
export function supabaseEnv(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}
