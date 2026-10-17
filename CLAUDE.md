# Car Maintenance

Free iOS and Android app for Canadian car owners to track maintenance, get reminders and find shops. Product scope and decisions: `docs/requirements.md`. How the code fits together: `docs/architecture.md`.

@AGENTS.md

## Before you call a task done

Run `npm run check` (typecheck, lint, tests). CI runs the same plus an iOS and Android bundle. The app targets iOS and Android. `npm run web` opens it in a browser for testing only, and every merge to `main` publishes that build to https://jaimepokhoy.github.io/car-maintenance/ (no responsive layout; reminders, CSV export and confirmation dialogs are native-only). Expo's version-matching API is blocked in some sandboxes; if `npx expo install` fails, pin the version from `node_modules/expo/bundledNativeModules.json` and use `npm install`.

## Conventions

- **Domain logic is pure TypeScript in `src/domain/`** with no React or Expo imports, and every rule there has unit tests in `src/domain/__tests__/`. Screens call into it; they don't reimplement it.
- **Units:** store distances in kilometres and money in integer cents. Convert only for display, via `src/domain/units.ts`.
- **Dates:** calendar dates are `YYYY-MM-DD` strings, handled with `src/domain/dates.ts`. Don't do date math with `Date` objects in local time.
- **Text:** every user-facing string goes through i18n (`useTranslation`), with keys in both `src/i18n/locales/en.json` and `fr.json`. A test fails if they drift. Canadian English spelling (kilometres, favourite).
- **Defaults are Canadian:** km, CAD, `en-CA` / `fr-CA` formatting.
- **Data model:** Postgres schema lives in `supabase/migrations/`. Rows are user-owned with RLS, IDs are client-generated UUIDs, `updated_at` drives sync, `deleted_at` is a soft delete. Add a new migration file; never edit an applied one.
- **Supabase is optional at runtime:** `src/lib/supabase.ts` exports `null` until env vars are set, and the app must work offline without it.
- **Styling:** the visual system is recorded in `docs/DESIGN.md` (product truth in `docs/PRODUCT.md`). Screens compose `src/components/` (`Card`, `Button`, `IconButton`, `Chip`, `SegmentedControl`, `TextField`, `ThemedText`) and read every colour, radius, size and font from `src/constants/theme.ts` via `useTheme()`; no hard-coded values in screens. Light and dark mode both matter, and the owner can force either in Settings.
- **Small PRs:** one issue, one PR, reviewable in a few minutes. Describe what changed for a user in the PR body.
