# Car Maintenance: Requirements and Build Plan

Agreed with Jaime on 2026-10-11. The Notion PRD mirrors the product sections; this file is the source of truth for builders.

## 0. Decisions

| Question | Decision |
|---|---|
| Platforms | iOS and Android at launch |
| Accounts and cloud backup | Yes, in v1 |
| Business model | Free (no paywall, no ads planned) |
| Who builds | Jaime, working with Claude |
| Launch market | Canada |
| Shop finder | In v1 (booking stays out) |
| Tech stack | Expo (React Native) + TypeScript, Supabase |

From Notion: competitor is carmaintenance.app; intended strengths are best-practice guidance, tracking, finding shops, and EV coverage; known weakness is that manual input is a chore.

## 1. Product in one sentence

A free mobile app where any Canadian car owner can keep every vehicle's service history in one place, learn what their car actually needs, get reminded before it's due, and find a nearby shop to do it.

## 2. Who it's for

- **Primary:** everyday owners with 1 to 3 cars who forget when the oil was last changed and lose receipts.
- **Secondary (later):** households sharing cars, DIY enthusiasts, people selling a car who want a clean service record.

## 3. v1 scope

| Area | What the user can do |
|---|---|
| Garage | Add multiple vehicles by VIN (camera barcode scan or typed, decoded via the free NHTSA vPIC API, which covers most North American vehicles) or by year/make/model. Nickname, photo, current odometer. Gas, hybrid or EV. |
| Service log | Record a service: type, date, odometer, cost, shop or DIY, notes, receipt photo. Edit and delete. |
| Maintenance schedule | Default schedule per powertrain with editable intervals in km and/or months. Gas: oil, tire rotation, brakes, filters, fluids, battery. EV: no oil; tires, brake fluid, cabin filter, coolant, 12V battery, HV battery health checks. |
| Seasonal tires | Spring and fall reminders for winter tire changeover, with which set is on the car. (Quebec requires winter tires Dec 1 to Mar 15.) |
| Best-practice guidance | A short plain-language card for each maintenance item: what it is, why it matters, typical interval, rough cost in CAD, DIY or shop. Main differentiator from a plain logbook. |
| Low-effort input | VIN scan, one-tap "done today" on a due item, remembered shops and typical costs. |
| Reminders | Push notification when an item is due soon or overdue, whichever of date or km comes first. Periodic nudge to update the odometer. |
| Dashboard | Per vehicle: due next, overdue, last service of each type. |
| Costs | Total and per-category spend per vehicle, per year. |
| Export | Share a vehicle's service history as PDF or CSV (useful when selling). |
| Account | Sign in with Apple, Google or email; data backed up to the cloud and synced across devices. Delete account and all data from inside the app. |

## 4. Not in v1 (candidates for later)

- **v1.1:** receipt OCR auto-fill (answers the manual-input concern), recall alerts (Transport Canada recalls database), French UI.
- **Cut:** the shop finder (nearby shops via Google Places, saved "my shop"). The owner decided not to ship it; logged services keep any shop already linked to them.
- **Later:** shop booking (needs shop partnerships), OBD-II / connected-car odometer sync, manufacturer-exact schedules, fuel and efficiency tracking, shared garages for families, web app, US launch.

## 5. Non-functional requirements

- One codebase for iOS and Android.
- Offline-first: everything works with no signal; sync when back online.
- Canada defaults: km, CAD, Canadian date format. Units and currency changeable per user.
- **Language:** all UI strings go through an i18n layer from day one. English at launch; French before any push into Quebec, where French-language requirements likely apply.
- **Privacy:** VIN, location and receipts are personal data. PIPEDA-aligned privacy policy, data hosted in Supabase's Canada region, no selling or sharing data.
- **Cost:** a free app needs near-zero running cost. Stay within Supabase's free or lowest tier at launch.
- Accessibility: dynamic type, screen reader labels, sufficient contrast.

## 6. Tech stack (agreed)

- **App:** Expo (React Native) + TypeScript; EAS for cloud builds and store submission; Expo Go to try changes on your phone.
- **Backend:** Supabase (Postgres, auth, storage for receipt photos, row-level security), Canada region.
- **Local data:** SQLite on device, synced to Supabase.
- **Notifications:** Expo Notifications scheduled locally so reminders work offline.
- **Quality gates:** TypeScript strict, ESLint, Jest unit tests, Maestro end-to-end flows, GitHub Actions CI on every PR.

## 7. How we build it with AI

With Jaime as the only builder, the setup is: Jaime is product owner and reviewer, Claude does the engineering.

- **Planning:** this doc plus a short architecture and data-model doc, written once with the strongest model. After that, plan one thin vertical slice at a time and re-plan after each ships.
- **Tasks live with the code:** spec in `docs/`, conventions in `CLAUDE.md`, and GitHub issues as the task queue, one issue per PR. Notion stays the human view: roadmap, decisions, and the Projects/Tasks databases at milestone level.
- **One model tier for building:** use the strong model for all code. Smaller models only for repetitive, fully specified chores.
- **Verification first:** CI, types and tests exist before features, so each PR proves itself before Jaime looks.
- **Small PRs:** each reviewable in a few minutes; Jaime tries each one on their phone through Expo before merging.
- **Parallel threads once foundations land:** independent features (shop finder, export, costs) can be built in separate threads in this project at the same time.

### Phases

| Phase | Output |
|---|---|
| 0. Align | This doc agreed ✅; GitHub repo created; Apple and Google developer accounts started (Apple's can take days). |
| 1. Foundations | Expo + Supabase scaffold, auth, data model, i18n, CI, `CLAUDE.md`, design tokens. |
| 2. Core loop | Garage with VIN scan, service log, odometer updates, schedules and dashboard. |
| 3. Reminders and guidance | Due/overdue logic (heavily unit-tested), push notifications, seasonal tires, guidance cards. |
| 4. Shop finder | Map, list, details, saved shop, link to service log. |
| 5. Polish | Costs, export, onboarding, settings, delete account, accessibility pass, privacy policy. |
| 6. Ship | TestFlight and Play internal testing with real users, then store submission in Canada. |

## 8. Accounts Jaime will need

- GitHub (repo for the code)
- Apple Developer Program (US$99/year) and Google Play Console (US$25 one-time)
- Expo account (free tier is enough to start)
- Supabase account (free tier to start)
