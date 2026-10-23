# Car Maintenance: Requirements and Build Plan

Agreed with Jaime on 2026-10-11. The Notion PRD mirrors the product sections; this file is the source of truth for builders.

## 0. Decisions

| Question | Decision |
|---|---|
| Platforms | iOS and Android at launch |
| Accounts and cloud backup | Yes, in v1 |
| Business model | Consumer app free (no paywall, no ads planned). Mechanic shops pay for their own branded app and a portal (section 9) |
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
| Shop finder | Map and list of nearby auto repair shops with rating, hours, distance; call, get directions, save as "my shop", and link a logged service to a shop. Data from a places API (Google Places by default), with results cached to keep a free app's API bill low. No booking. |
| Costs | Total and per-category spend per vehicle, per year. |
| Export | Share a vehicle's service history as PDF or CSV (useful when selling). |
| Account | Sign in with Apple, Google or email; data backed up to the cloud and synced across devices. Delete account and all data from inside the app. |

## 4. Not in v1 (candidates for later)

- **v1.1:** receipt OCR auto-fill (answers the manual-input concern), recall alerts (Transport Canada recalls database), French UI.
- **Later:** shop booking (needs shop partnerships), OBD-II / connected-car odometer sync, manufacturer-exact schedules, fuel and efficiency tracking, shared garages for families, web app, US launch.

## 5. Non-functional requirements

- One codebase for iOS and Android.
- Offline-first: everything except the shop finder works with no signal; sync when back online.
- Canada defaults: km, CAD, Canadian date format. Units and currency changeable per user.
- **Language:** all UI strings go through an i18n layer from day one. English at launch; French before any push into Quebec, where French-language requirements likely apply.
- **Privacy:** VIN, location and receipts are personal data. PIPEDA-aligned privacy policy, data hosted in Supabase's Canada region, no selling data, location used only while the shop finder is open. Data is shared only with a shop the owner explicitly chooses in that shop's app, and the owner can revoke it at any time (section 9).
- **Cost:** a free app needs near-zero running cost. Stay within Supabase's free or lowest tier at launch; cap and cache places API calls.
- Accessibility: dynamic type, screen reader labels, sufficient contrast.

## 6. Tech stack (agreed)

- **App:** Expo (React Native) + TypeScript; EAS for cloud builds and store submission; Expo Go to try changes on your phone.
- **Backend:** Supabase (Postgres, auth, storage for receipt photos, row-level security), Canada region.
- **Local data:** SQLite on device, synced to Supabase.
- **Notifications:** Expo Notifications scheduled locally so reminders work offline.
- **Maps and places:** react-native-maps plus Google Places API.
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
- Google Cloud account with Places API enabled (has a monthly free usage allowance)

Each shop brings its own Apple and Google accounts for its app (section 9 and `docs/tenants.md`).

## 9. Shops as customers (B2B)

Agreed on 2026-10-22. The model is BiblioCommons for libraries: one platform and codebase, and each mechanic shop gets an app under its own name and colours, plus a web portal for its staff. The unbranded consumer app stays, free, as the default tenant.

| Question | Decision |
|---|---|
| Who pays | Shops. Car owners never pay, in the consumer app or in a shop's app |
| Distribution | A separate App Store and Play listing per shop, published from the shop's own developer accounts |
| Onboarding and billing | Manual: Jaime sets each shop up (runbook in `docs/tenants.md`) and invoices it. No self-serve sign-up or billing yet |
| Backend | One multi-tenant Supabase project in the Canada region, not one per shop |
| Sharing | A customer's data reaches a shop only after they agree in that shop's app; they can revoke it in Settings |

### What a shop gets (v1)

| Area | What it does |
|---|---|
| Branded app | The shop's name, icon, splash and accent colour. A "Your shop" tab with hours, call, directions and booking link replaces the shop finder. The shop is pre-saved as the customer's shop |
| Brand settings | In the portal: logo, accent colour (with a contrast check), contact details, hours, booking and website links. Changes reach the app without a store update |
| Customers | Customers who agreed to share, with their vehicles and what is due soon or overdue |
| Log a service | Staff add a service to a customer's history. It syncs to the customer's phone with a "Logged by <shop>" badge; the customer can change only its notes |
| Messages | Push reminders and promotions to all customers or to those with service due soon or overdue, 4 sends per 30 days |

### Consent and messages

- Sharing is opt-in per shop, asked once in the shop's app ("Not now" is remembered on the device). Revoking stops the shop's access immediately; sharing again reuses the same link.
- **CASL:** a promotion is a commercial electronic message, so it needs the customer's explicit opt-in to promotions, separate from their consent to share data. Service reminders about the customer's own vehicle are a separate category and don't need that opt-in. Every promotion names the shop and the customer can opt out in the app. Messages don't have a reminder or promotion type yet, and the app has no promotions opt-in, so shops must not send promotions until both ship.
- **Privacy:** each shop signs a data-processing agreement before go-live, and the shop's app has its own privacy policy naming the shop as a recipient under consent. Data stays in the Canada region. Details in `docs/tenants.md` (Privacy).

### Not in v1

Self-serve shop sign-up and billing, staff management in the portal (Jaime adds staff at onboarding), saved message drafts, customer names in the portal (customers show as "Customer since <date>"), shop booking.
