/** Rules for remote push. Expo and Supabase calls live in `src/lib/push.ts`. */

export type PushPlatform = 'ios' | 'android';

/** The `push_tokens.platform` for this OS, or `null` where remote push isn't offered (web). */
export function pushPlatform(os: string): PushPlatform | null {
  return os === 'ios' || os === 'android' ? os : null;
}

/** Shop campaigns (reminders and promotions) carry `{ type: "campaign" }` in their data. */
export function isCampaignNotification(data: unknown): boolean {
  return (data as { type?: unknown } | null | undefined)?.type === 'campaign';
}

/**
 * Where a tapped notification opens: shop campaigns open the home tab, local
 * reminders the screen in their `url`. `null` leaves the app where it is.
 */
export function notificationTarget(data: unknown): string | null {
  if (isCampaignNotification(data)) return '/';
  const url = (data as { url?: unknown } | null | undefined)?.url;
  return typeof url === 'string' && url.startsWith('/') ? url : null;
}
