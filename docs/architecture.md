# Architecture

## Layers

```
src/app/          Screens (Expo Router: every file is a route)
src/components/   Shared UI
src/domain/       Pure business rules: schedules, due status, tires, units, dates
src/i18n/         English and French strings, language detection
src/db/           On-device SQLite: migrations and queries
src/hooks/        Shared hooks (database queries that refresh on focus, locale)
src/lib/          Integrations (Supabase client)
supabase/         Database migrations and RLS policies
```

Screens depend on domain and lib; domain depends on nothing. That keeps the rules that matter most (is my oil change overdue?) fast to test and easy to change.

## Data flow (target)

1. The device is the source of truth for the UI: all reads and writes go to a local SQLite database, so the app works with no signal.
2. When signed in and online, a sync step pushes local rows changed since the last sync and pulls remote rows with a newer `updated_at`. Deletes are soft (`deleted_at`) so they sync like any other change. Last write wins per row.
3. Reminders are computed on device from the local data (`computeVehicleDueStatuses`) and scheduled as local notifications, so they fire offline.
4. There are no online-only features: the nearby shop finder was cut (see Shops below).

Status: domain rules, i18n, the Supabase schema and client, and local SQLite storage for vehicles and service records exist. Sync and notifications are upcoming slices.

Data-layer functions in `src/db/` take a `Db` (a subset of expo-sqlite's API) so tests run them against Node's built-in SQLite via `src/test-utils/memory-db.ts`.

## Reminder rules

- An item is due at whichever of its date limit or distance limit comes first.
- "Due soon" means within 30 days or 1,000 km (`DUE_SOON_DAYS`, `DUE_SOON_KM`).
- Items never logged are `unknown`; the UI asks when they were last done instead of guessing.
- Default intervals per powertrain are in `src/domain/schedules.ts`; owners can override any of them per vehicle (`maintenance_intervals` table).
- Seasonal tire reminders: install from October 15, remove from April 15; Quebec adds the December 1 legal deadline.

## Shops

- **The shop finder has been cut and is not shipping.** The Shops tab, nearby search (Google Places) and the guide's "Find a shop" button were removed.
- The `shops` table and `src/db/shops.ts` stay: service records still link to a saved shop through `shop_id`, and the vehicle history and CSV export show that shop's name. The service form still offers any shops an owner saved before the cut.
