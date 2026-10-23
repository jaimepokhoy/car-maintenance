# Architecture

## Layers

```
src/app/          Screens (Expo Router: every file is a route)
src/components/   Shared UI
src/domain/       Pure business rules: schedules, due status, tires, units, dates, sync, tenants, campaigns
src/i18n/         English and French strings, language detection
src/db/           On-device SQLite: migrations and queries
src/hooks/        Shared hooks (database queries that refresh on focus, locale, session, sync, tenant)
src/lib/          Integrations (Supabase client, auth, sync, push, places, tenant config)
tenants/<slug>/   One folder per app build: tenant.json, optional profile.json, icons and splash
supabase/         Database migrations, RLS policies, SQL tests, the send-campaign Edge Function
portal/           Shop portal (Next.js), a separate package that reuses src/domain/
scripts/          new-tenant.ts scaffolds a shop's tenant folder and EAS profiles
```

Screens depend on domain and lib; domain depends on nothing. That keeps the rules that matter most (is my oil change overdue?) fast to test and easy to change, and lets the portal and the Edge Function reuse them.

## Data flow

1. The device is the source of truth for the UI: all reads and writes go to a local SQLite database, so the app works with no signal.
2. When signed in and online, sync (`src/hooks/use-sync.tsx`, rules in `src/domain/sync.ts`) pushes local rows changed since the last sync and pulls remote rows with a newer `updated_at`. Deletes are soft (`deleted_at`) so they sync like any other change. Last write wins per row, and the server, not the device, stamps `updated_at`.
3. Reminders are computed on device from the local data (`computeVehicleDueStatuses`) and scheduled as local notifications, so they fire offline.
4. Shop search is the one online-only feature: the device calls the places API directly and caches results.

Status: domain rules, i18n, local SQLite storage, sign-in (email code, Apple, Google), cloud sync, local reminders, the shop finder, delete account, white-label builds, the shop portal (brand, customers, log a service, messages) and remote push for shop messages exist. Self-serve shop onboarding, billing and receipt uploads don't.

Data-layer functions in `src/db/` take a `Db` (a subset of expo-sqlite's API) so tests run them against Node's built-in SQLite via `src/test-utils/memory-db.ts`.

## Reminder rules

- An item is due at whichever of its date limit or distance limit comes first.
- "Due soon" means within 30 days or 1,000 km (`DUE_SOON_DAYS`, `DUE_SOON_KM`).
- Items never logged are `unknown`; the UI asks when they were last done instead of guessing.
- Default intervals per powertrain are in `src/domain/schedules.ts`; owners can override any of them per vehicle (`maintenance_intervals` table).
- Seasonal tire reminders: install from October 15, remove from April 15; Quebec adds the December 1 legal deadline.

## Shop finder

- Nearby search uses Google Places API (New) `searchNearby` with type `car_repair`, 10 km around the phone's location (`src/lib/places.ts`). Results are cached in memory for 30 minutes per ~1 km area to keep API costs down; nothing from search is written to disk.
- Saving a shop stores its place ID plus the name, address and phone the owner chose to keep (`shops` table). Service records link to a saved shop through `shop_id`.
- Location permission is asked only when the owner taps "Allow location"; the app never reads location in the background.

## Accounts and sync

- `SessionProvider` / `useSession` (`src/hooks/use-session.tsx`) hold the Supabase Auth session; `src/lib/auth.ts` runs email code, Apple and Google sign-in. The client uses PKCE. Without Supabase the app stays signed out and works offline.
- Synced tables, parents first: `vehicles`, `shops`, `maintenance_intervals`, `service_records`, `customer_links` (`SYNC_TABLES`). `receipt_path` isn't synced; it is a local file path until receipt uploads exist.
- Every pull filters `user_id = auth.uid()` (`src/lib/sync.ts`). RLS also lets shop staff read their linked customers' rows, and those must never land in a staff member's own database.
- Signing in to a different account on the same device uploads the device's data to that account. Rows the server already holds for the first account are refused by RLS and stay pending.
- Delete account calls `public.delete_account()`, which removes the user and their rows.
- Provider setup (email templates with `{{ .Token }}`, Apple and Google client IDs, redirect URLs) is in `docs/tenants.md`, since every shop's app adds to it.

## White-label shops

The platform works like BiblioCommons for libraries: one codebase and one Supabase project, and each mechanic shop gets its own store app plus a web portal. The unbranded consumer app is the `default` tenant. Business rules are in `docs/requirements.md` (section 9); onboarding steps are in `docs/tenants.md`.

### Two branding layers

1. **Build-time identity** (needs a store build): `tenants/<slug>/tenant.json` (app name, bundle ID and package, URL scheme, default accent, splash colour, EAS Update channel) and `tenants/<slug>/assets/`. `app.config.ts` reads `TENANT` (default `default`) and exposes the file as `extra.tenant`; `src/lib/tenant-config.ts` exports `bundledTenant` and `isBrandedBuild`. An optional `profile.json` is bundled as `extra.tenantProfile`, so a new install shows the shop's details before it ever goes online. Loading the TypeScript config needs Node 22.18 or later.
2. **Runtime brand** (no store update): `TenantProvider` / `useTenant()` (`src/hooks/use-tenant.tsx`) reads the shop's row from the `tenant_profiles` view, caches it in the `settings` table and falls back to the bundled files. `useTheme()` lays the shop's accent (and `onAccent`, from `pickOnAccent` when missing) over Night Drive; nothing else in the theme changes (`docs/DESIGN.md`). The default build skips all of this.

`eas.json` has `<slug>-development`, `<slug>-preview` and `<slug>-production` profiles per tenant, each setting `TENANT` and its own update channel (`<slug>-development`, `<slug>-preview`, `<slug>`), so a JS fix reaches every shop's app through EAS Update without store review. CI bundles iOS and Android for `default` and `demo-shop`. `metro.config.js` keys Metro's cache on the tenant's files, so switching `TENANT` locally doesn't need `--clear`.

In a branded build the Shops tab becomes "Your shop" (hours, call, directions, booking link) instead of the Places finder. The shop is saved in `shops` with `place_id = 'tenant:<slug>'` and a random UUID, so logged services link to it. "Open now" uses the device's clock; `tenants` has no time zone yet.

### Tenancy in Supabase

Migrations from `20261022000000_tenancy.sql` on. Customer data stays user-owned; a shop sees it only through consent.

| Table or function | Purpose |
|---|---|
| `tenants` | One row per shop: slug, name, `status` (`active` or `suspended`), `brand` JSON, contact details, hours, links. Created by the operator with the service role; staff edit their own shop's profile but not its slug or status |
| `tenant_profiles` | Public, read-only view of active shops for `anon` and `authenticated`. It runs with the owner's rights so `tenants` stays closed; Supabase's advisor flags it as a security definer view, which is intended |
| `tenant_staff` | Who works at which shop (`owner` or `staff`). Added by the operator at onboarding |
| `customer_links` | One row per customer and shop, written by the customer from the shop's app. Live while `revoked_at` and `deleted_at` are null; revoking sets `revoked_at`, sharing again clears it on the same row |
| `is_tenant_staff`, `is_linked_customer` | Security definer helpers the policies call |
| `service_records.created_by_tenant_id` | Set when a shop logs the service. `guard_created_by_tenant` stops a customer claiming a shop wrote their record; `guard_shop_record_fields` lets the customer change only `notes` and `deleted_at` on a shop's record (hard delete and account deletion stay allowed) |
| `push_tokens` | Expo push tokens, written only through `register_push_token` |
| `customer_links.promotions_opt_in_at` | Set by the customer to receive that shop's promotions; staff can read it but not set it |
| `campaigns`, `campaign_failures` | Shop messages (`kind` is `service_reminder` or `promotion`) and per-device failures, written only by `send-campaign` |
| `tenant-assets` bucket | Shop logos, public read, staff write under `<tenant_id>/` |

Staff can read `vehicles`, `service_records`, `maintenance_intervals` and `shops` of customers with a live link, and insert or update `service_records` for them only with `created_by_tenant_id` set to their shop. RLS tests are in `supabase/tests/` (`npx supabase test db` against the local stack); CI doesn't run them yet.

### Consent in the app

A branded app asks once after sign-in whether to share with the shop (`src/app/consent.tsx`). "Share" writes a `customer_links` row; "Not now" is stored on the device only (`consent.declined.<tenantId>` in `settings`). Settings lists the shops with access and revokes it. Swiping the prompt away counts as neither answer, so it comes back on the next launch. `tenant_names` is a local, unsynced cache of shop names for "Shared with" and "Logged by".

Shop-logged services sync down like any other row and show "Logged by <shop>". Only their notes can be changed in the app, and they can't be deleted there.

### Remote push

After sign-in the app registers its Expo push token with `register_push_token`, tagged with the shop it was built for (`tenant_profiles.id` of `extra.tenant.slug`, or null in the default app), and deletes it on sign-out (`src/lib/push.ts`). The function accepts only Expo tokens and active shops, and takes a token over from a device's previous user. Remote push needs a development or store build with `extra.eas.projectId`; it does nothing in Expo Go, on web or without Supabase. Shop messages arrive on the Android channel `shop-messages`. Service reminders stay local notifications (`src/lib/reminders.ts`).

### Shop portal

`portal/` is a Next.js app with Supabase Auth through `@supabase/ssr` (setup in `portal/README.md`). It uses only the anon key, so RLS is the security boundary. Staff sign in by email code (no sign-up), pick a shop, then use:

- **Brand:** logo upload, accent with a live contrast check, contact details, hours (one opening per day), booking and website links.
- **Customers:** linked customers as "Customer since <date>" (staff can't read names), their vehicles and what is due. The odometer shown is the higher of the vehicle's and its latest service's. "Today" is the Newfoundland date, so no Canadian shop sees today's work rejected as a future date.
- **Log a service** for a linked customer.
- **Messages:** compose a service reminder or promotion, preview the audience, send, and see past messages.

The portal imports pure code from `src/domain/` (`portal/lib/domain.ts`) for due status, units and dates, so it can't disagree with the app.

### send-campaign Edge Function

`supabase/functions/send-campaign/` (details in its README) checks that the caller is staff of an active shop and picks linked customers. Every message has a `kind`: a `promotion` goes only to customers who opted in to that shop's promotions (`customer_links.promotions_opt_in_at`, which only the customer can set), a `service_reminder` to every linked customer. The audience is all of them or those with something due soon or overdue (`src/domain/campaigns.ts`). It sends through the Expo Push API to tokens registered from that shop's app. `start_campaign` enforces 4 sends per shop in any rolling 30 days (`CAMPAIGN_LIMIT`, `CAMPAIGN_WINDOW_DAYS`) in one locked transaction; sends that reached nobody don't count. The portal's preview id is the idempotency key. Deploy with `npx supabase functions deploy send-campaign`. The function can't import from outside `supabase/functions`, so it uses a generated copy of the domain modules it needs in `supabase/functions/_shared/domain/`. After changing `src/domain/campaigns.ts` or anything it imports, run `npm run functions:domain`; `npm run check` and CI fail when the copy is stale.

## Open follow-ups

- `is_linked_customer(tenant, customer)` is callable by any signed-in user, so anyone can probe whether a given user shares with a given shop. Restrict it to that shop's staff and the customer, or move it out of the exposed schema.
- A suspended shop keeps its staff's access to customer data: the staff policies check `tenant_staff` and the link, not `tenants.status`. Suspension today only hides the profile and blocks messages and push registration.
- The app has no promotions opt-in toggle yet (CASL, `docs/requirements.md` section 9), so promotions reach nobody. It needs a per-shop toggle that sets and clears `customer_links.promotions_opt_in_at`, plus that column in the app's local schema and sync columns.
- `app.config.ts` sets no per-tenant `extra.eas.projectId`, which EAS Build and remote push need for each shop's EAS project (`docs/tenants.md`, step 6).
- When a shop's service syncs down with a higher odometer, the app should move the vehicle's odometer forward.
- `tenants` has no time-zone field; "open now" assumes the device's zone.
- Old logos stay in `tenant-assets` when a shop replaces one.
- Play's Data safety form needs a web account-deletion URL.
- CI doesn't run `npx supabase test db` yet.
