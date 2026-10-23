# Shop portal

Web app where a shop's staff manage their white-label app. Next.js (App Router) with Supabase Auth through `@supabase/ssr`. Separate package from the Expo app at the repo root; the root checks ignore this folder.

## Run it

```bash
cd portal
npm install
cp .env.example .env.local   # Supabase URL and anon key
npm run dev                  # http://localhost:3000
```

Only the anon key is used: every query runs as the signed-in staff member, and the `tenants`, `tenant_staff` and `storage.objects` RLS policies in `supabase/migrations/` decide what they can see and change. Never put the service-role key here.

## Pages

- `/sign-in`: email one-time code. `shouldCreateUser` is off, so only accounts created at onboarding can sign in. The Supabase email template must include `{{ .Token }}` for the code to arrive.
- `/tenants`: shop picker for staff of several shops (`tenant_staff`); staff of one shop go straight to its Brand page.
- `/t/<tenant id>/brand`: logo (uploaded to `tenant-assets/<tenant id>/`), accent colour with a live contrast check and light/dark preview, name, contact details, opening hours, booking and website links. Saves to `tenants`.
- `/t/<tenant id>/messages`: compose a reminder or promotion (title, message, all customers or those with service due soon or overdue), preview who it reaches, send it, and see past messages with delivery counts. Preview and send call the `send-campaign` Edge Function (`supabase/functions/send-campaign/`) with the staff member's access token; the function holds the service-role key and enforces 4 messages per shop in 30 days.

Strings live in `lib/i18n/messages.ts` (English and French, same keys). Pure logic is in `lib/` with Vitest tests in `lib/__tests__/`.

## Checks

```bash
npm run check   # typecheck, lint, tests
npm run build
```
