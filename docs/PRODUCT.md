# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Everyday Canadian car owners with one to three cars who forget when the oil was last changed and lose receipts. They use the app in short bursts: in the driveway after a service, in a shop waiting room, or when a reminder fires. Later audiences (households sharing cars, DIY enthusiasts, sellers wanting a clean record) are noted in `docs/requirements.md` but not confirmed for v1.

## Product Purpose

A free mobile app where a car owner keeps every vehicle's service history in one place, learns what the car actually needs, gets reminded before something is due, and finds a nearby shop to do it. Success is an owner who never misses an interval and can show a buyer a complete record.

## Positioning

Plain-language best-practice guidance per maintenance item (what, why, typical interval, rough cost in CAD, DIY or shop), tied to the owner's own vehicle and odometer. Competitor logbooks record; this one explains. EV and hybrid schedules are first-class, and winter tire changeovers follow provincial rules, including Quebec's legal deadline.

## Operating Context

- iOS and Android phones only, portrait, one Expo codebase. No web.
- Offline-first: everything except the shop finder works with no signal. Local SQLite, optional Supabase sync.
- Reminders arrive as local push notifications; tapping one opens the relevant screen.
- Canada defaults: kilometres, CAD, en-CA and fr-CA formatting. English and French UI.
- Known pain point: manual input is a chore. Low-effort entry (one-tap "done today", prefilled odometer, remembered shops) matters more than feature count.

## Capabilities and Constraints

Confirmed and built: multi-vehicle garage (VIN decode via NHTSA vPIC, year/make/model pickers, nickname, trim, plate, tire size, gas/hybrid/EV), service log with cost and shop, default maintenance schedule per powertrain with due status (overdue, due soon, OK, not logged), seasonal tire set and provincial changeover reminders, guidance card per item, cost summaries, CSV export, language and unit preferences.

Not built (do not imply in UI): camera VIN scanning, receipt photos or OCR, account sign-in or cloud backup, booking, any shop finder or shop search (cut, not shipping), recall alerts.

Technical rules: domain logic in `src/domain/` is pure TypeScript with tests; all user-facing text goes through i18n with keys in both `en.json` and `fr.json` (a test fails if they drift); distances stored in km and money in cents; Postgres rows user-owned with RLS. Styling comes from `src/constants/theme.ts` only.

## Brand Commitments

Name: Car Maintenance. Voice: plain, direct, Canadian English spelling (kilometres, favourite), no jargon, no hype. Visual direction is user-pinned to the "Night Drive" design canvas (claude.ai/artifact/XzktGoXuWAYQuhKcL7Bcv2): near-black ground with cyan accent, Barlow and Barlow Semi Condensed, rounded cards, floating pill tab bar. Bundled Barlow fonts and the custom pill tab bar were confirmed by the user on 2026-10-14.

## Evidence on Hand

- Product spec and decisions: `docs/requirements.md`, `docs/architecture.md`.
- Design canvas: 8 screens in dark and light (Garage, Garage empty, Add vehicle, Vehicle, Log service, Guide, Shops, Settings); sources saved from the canvas during the redesign session.
- No real user data, testimonials, shop partners or pricing exist. Sample vehicles in mockups (a 2019 Honda CR-V, a Hyundai Ioniq 5) are illustrative only.

## Product Principles

1. Explain, don't just record: every due item links to why it matters.
2. One tap beats one form: the common path (done today, update odometer) is a single action.
3. Due state is the hierarchy: overdue first, then due soon, then everything else.
4. Works in the driveway with no signal, in both languages, in both appearances.
5. Never claim a capability the app lacks (scanning, sync, booking).

## Accessibility & Inclusion

Dynamic type must not clip (allow font scaling, no fixed-height text containers), every control has a label and a 44pt target, colour never carries state alone (due state also has text), contrast at least 4.5:1 for body text in both appearances, screen-reader headers on sections.
