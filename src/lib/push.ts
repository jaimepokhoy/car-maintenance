import type { SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { SHOP_CHANNEL_ID, pushPlatform, tenantSlugFromExtra } from '@/domain';
import i18n from '@/i18n';

export { SHOP_CHANNEL_ID };

/** How long sign-out waits for the token delete before it signs out anyway. */
const REMOVE_TIMEOUT_MS = 3_000;

/** The token registered in this run of the app, and for whom, so foregrounding doesn't re-upload it. */
let registered: { token: string; userId: string } | null = null;

/** The registration in progress, which sign-out waits for so it can't land after the delete. */
let inFlight: Promise<unknown> = Promise.resolve();

/** Expo needs the EAS project to issue a token; builds without one skip remote push. */
function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/** The shop this build belongs to, or `null` in the unbranded app or when its slug has no active shop. */
async function tenantId(client: SupabaseClient): Promise<string | null> {
  const slug = tenantSlugFromExtra(Constants.expoConfig?.extra);
  if (!slug) return null;
  const { data, error } = await client.from('tenant_profiles').select('id').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return (data as { id?: string } | null)?.id ?? null;
}

/**
 * Saves this device's Expo push token for the signed-in owner, so their shop
 * can reach them. Only on a physical iOS or Android device that already has
 * notification permission: this never asks for it (reminders do, when there's
 * something to remind about).
 */
export function registerPushToken(client: SupabaseClient, userId: string): Promise<void> {
  const run = register(client, userId);
  inFlight = run.catch(() => {});
  return run;
}

async function register(client: SupabaseClient, userId: string): Promise<void> {
  const platform = pushPlatform(Platform.OS);
  const id = projectId();
  if (!platform || !Device.isDevice || !id) return;
  if (registered?.userId === userId) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;

  if (platform === 'android') {
    // Android needs a channel before it hands out a token.
    await Notifications.setNotificationChannelAsync(SHOP_CHANNEL_ID, {
      name: i18n.t('push.channelName'),
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
  // An RPC rather than an upsert: it takes the token over from whoever had this phone before.
  const { error } = await client.rpc('register_push_token', {
    p_token: token,
    p_platform: platform,
    p_tenant_id: await tenantId(client),
  });
  if (error) throw error;
  registered = { token, userId };
}

/** Fire-and-forget registration; offline or a failed request just tries again next time. */
export function refreshPushToken(client: SupabaseClient, userId: string): void {
  registerPushToken(client, userId).catch((error) => console.warn('Could not register for push', error));
}

/** This device's token if it can have one, without asking for permission. */
async function deviceToken(): Promise<string | null> {
  const id = projectId();
  if (!pushPlatform(Platform.OS) || !Device.isDevice || !id) return null;
  if (!(await Notifications.getPermissionsAsync()).granted) return null;
  return (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
}

/**
 * Deletes this device's token while the session is still valid, so the owner
 * stops getting shop messages once signed out. Gives up after a few seconds
 * so signing out offline isn't held up.
 */
export async function removePushToken(client: SupabaseClient): Promise<void> {
  async function remove() {
    await inFlight;
    const known = registered?.token;
    registered = null;
    const token = known ?? (await deviceToken());
    if (!token) return;
    const { error } = await client.from('push_tokens').delete().eq('token', token);
    if (error) throw error;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, REMOVE_TIMEOUT_MS);
  });
  try {
    await Promise.race([remove(), timeout]);
  } catch (error) {
    console.warn('Could not remove push token', error);
  } finally {
    clearTimeout(timer);
  }
}
