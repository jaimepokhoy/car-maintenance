# Architecture

## Layers

```
src/app/          Screens (Expo Router: every file is a route)
src/components/   Shared UI
src/domain/       Pure business rules: schedules, due status, tires, units, dates
src/i18n/         English and French strings, language detection
src/lib/          Integrations (Supabase client)
supabase/         Database migrations and RLS policies
```

Screens depend on domain and lib; domain depends on nothing. That keeps the rules that matter most (is my oil change overdue?) fast to test and easy to change.

## Data flow (target)

1. The device is the source of truth for the UI: all reads and writes go to a local SQLite database, so the app works with no signal.
2. When signed in and online, a sync step pushes local rows changed since the last sync and pulls remote rows with a newer `updated_at`. Deletes are soft (`deleted_at`) so they sync like any other change. Last write wins per row.
3. Reminders are computed on device from the local data (`computeVehicleDueStatuses`) and scheduled as local notifications, so they fire offline.
4. Shop search is the one online-only feature: the device calls the places API directly and caches results.

Status: domain rules, i18n, schema and the Supabase client exist. Local SQLite storage, sync, notifications and the shop finder are upcoming slices.

## Reminder rules

- An item is due at whichever of its date limit or distance limit comes first.
- "Due soon" means within 30 days or 1,000 km (`DUE_SOON_DAYS`, `DUE_SOON_KM`).
- Items never logged are `unknown`; the UI asks when they were last done instead of guessing.
- Default intervals per powertrain are in `src/domain/schedules.ts`; owners can override any of them per vehicle (`maintenance_intervals` table).
- Seasonal tire reminders: install from October 15, remove from April 15; Quebec adds the December 1 legal deadline.
