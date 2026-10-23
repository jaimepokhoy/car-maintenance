import { createBrowserClient } from '@supabase/ssr';

/** Browser client sharing the session cookies with the server. Pass `supabaseEnv()` read on the server. */
export function createClient(env: { url: string; anonKey: string }) {
  return createBrowserClient(env.url, env.anonKey);
}
