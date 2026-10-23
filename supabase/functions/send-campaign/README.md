# send-campaign

Sends a shop's reminder or promotion as a push notification to its linked customers. The portal's Messages page calls it with the staff member's access token.

`POST /functions/v1/send-campaign` with `{ tenantId, title, body, audience: "all" | "due_soon", dryRun?, campaignId? }`:

- `dryRun: true`: `{ customers, devices, allowance: { remaining, nextAvailableAt } }`, nothing written.
- Send: needs `campaignId`, a UUID the portal generates per preview. Returns `{ campaignId, customers, devices, sent, failed }`.
- Errors:
  - `401` without a valid token.
  - `403` unless the caller is staff of an active shop.
  - `400` for an invalid campaign or a missing `campaignId`.
  - `409` when that `campaignId` was already sent (a double click or a retry).
  - `422` when nobody would get it.
  - `429` past 4 sends in 30 days.
  - `500 send_interrupted` when the send started but failed before it could reply, so some phones may already have it.

Recipients are customers with a live `customer_links` row; `due_soon` keeps those with an item due soon or overdue, using `src/domain/campaigns.ts` (the same due rules as the app and the portal). Only push tokens registered from this shop's app (`push_tokens.tenant_id`) are used. Messages go to the Expo Push API in batches of 100, on the app's `shop-messages` Android channel.

The `start_campaign` SQL function checks the limit and records the campaign in one locked transaction. After that:

- Counts are written after each batch. A send with no progress after 15 minutes stopped early, and doesn't count toward the limit.
- Failures go to `campaign_failures`, with push tokens removed from Expo's messages.
- Tokens Expo reports as `DeviceNotRegistered` are deleted.

Secrets: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided by Supabase. Set `EXPO_ACCESS_TOKEN` if the Expo project has enhanced push security turned on.

`deno.json` maps the extensionless imports inside `src/domain/` to their `.ts` files, since the Edge Runtime doesn't resolve them. Add an entry when `campaigns.ts` starts importing another domain module.

```bash
cd supabase/functions/send-campaign
npx deno test            # handler tests with an in-memory store and fake Expo
npx supabase functions serve send-campaign   # from the repo root, with the local stack running
```
