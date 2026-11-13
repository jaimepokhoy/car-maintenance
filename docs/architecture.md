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
4. Shop search is the one online-only feature: the device calls the places API directly and caches results.

Status: domain rules, i18n, the Supabase schema and client, and local SQLite storage for vehicles, service records and expenses exist. Sync, notifications and the shop finder are upcoming slices.

Data-layer functions in `src/db/` take a `Db` (a subset of expo-sqlite's API) so tests run them against Node's built-in SQLite via `src/test-utils/memory-db.ts`.

## Reminder rules

- An item is due at whichever of its date limit or distance limit comes first.
- "Due soon" means within 30 days or 1,000 km (`DUE_SOON_DAYS`, `DUE_SOON_KM`).
- Items never logged are `unknown`; the UI asks when they were last done instead of guessing.
- Default intervals per powertrain are in `src/domain/schedules.ts`; owners can override any of them per vehicle (`maintenance_intervals` table).
- Where the make is covered by `src/domain/manufacturer-schedules.ts`, `resolveVehicleSchedule` starts from that maker's normal-duty schedule instead of the general defaults, then applies the owner's overrides. The guide screen names the maker and says the owner's manual wins for the exact model and trim. Makes with no entry keep the general guidance; nothing is presented as a verified OEM schedule for them.
- Seasonal tire reminders: install from October 15, remove from April 15; Quebec adds the December 1 legal deadline.

## Costs and expenses

- `service_records.cost_cents` holds what a logged maintenance job cost; the `expenses` table holds every other ownership cost (fuel, insurance, registration, repairs, tires, parking, tolls, wash, other). An expense requires an amount, unlike a service.
- `summarizeSpend` in `src/domain/costs.ts` combines both into all-time, this-year, last-12-month and monthly-average totals, plus a category breakdown. Services logged without a cost stay "unpriced" so the UI can say totals are partial.
- Logging an expense with a higher odometer reading moves the vehicle's odometer forward, the same as logging a service.

## Report card

- `evaluateVehicle` in `src/domain/evaluation.ts` turns the logged history into a 0–100 care score: half for keeping tracked items up to date (an item due soon counts half) and half for how much of the schedule has any history. A vehicle with nothing logged has no score.
- It also reports the spend totals, the distance covered by the logged readings, cost per 1,000 km, and the most urgent tracked item. It is a maintenance-hygiene score, not a market valuation, and the screen says so.

## Shop finder

- Nearby search uses Google Places API (New) `searchNearby` with type `car_repair`, 10 km around the phone's location (`src/lib/places.ts`). Results are cached in memory for 30 minutes per ~1 km area to keep API costs down; nothing from search is written to disk.
- Saving a shop stores its place ID plus the name, address and phone the owner chose to keep (`shops` table). Service records link to a saved shop through `shop_id`.
- Location permission is asked only when the owner taps "Allow location"; the app never reads location in the background.
