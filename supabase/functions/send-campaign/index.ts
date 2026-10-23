/**
 * send-campaign: sends a shop's reminder or promotion as a push notification
 * to its linked customers. Called by the portal with the staff member's
 * access token; see handler.ts for the request and response.
 *
 * The service-role key never leaves this function. Optional secret
 * EXPO_ACCESS_TOKEN is sent to Expo when the project requires one
 * (Expo's "enhanced push security").
 */
import { createClient } from '@supabase/supabase-js';

import type { ExpoPushTicket } from '../../../src/domain/campaigns.ts';
import { type PushSender, createHandler } from './handler.ts';
import { supabaseStore } from './store.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const url = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
if (!url || !serviceRoleKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');

const sendPush: PushSender = async (messages) => {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(expoAccessToken ? { Authorization: `Bearer ${expoAccessToken}` } : {}),
    },
    body: JSON.stringify(messages),
  });
  const payload = await response.json().catch(() => null);
  const tickets = (payload as { data?: ExpoPushTicket[] } | null)?.data;
  if (!response.ok || !Array.isArray(tickets)) {
    const errors = (payload as { errors?: { code?: string; message?: string }[] } | null)?.errors;
    return { error: errors?.map((e) => e.code ?? e.message).join(', ') || `HTTP ${response.status}` };
  }
  return { tickets };
};

Deno.serve(createHandler({ store: supabaseStore(admin), sendPush }));
