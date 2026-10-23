# Onboarding a shop

How to set up a mechanic shop as a customer: its own app in the stores and its staff in the portal. Onboarding is manual and invoiced (`docs/requirements.md`, section 9). How the pieces fit is in `docs/architecture.md` ("White-label shops").

Allow a few weeks: the shop's Apple organization account needs a D-U-N-S number, and that alone can take one to two weeks.

## 1. Agreements and accounts (the shop does these)

- **Contract and data-processing agreement.** The shop signs both before any customer data reaches it (see Privacy below).
- **Apple Developer Program, as an organization.** App Store guideline 4.2.6 rejects apps made from a template unless the content provider submits them, so each shop's app is published from the shop's own account, not ours. An organization account needs the shop's legal entity name and a D-U-N-S number (free from Dun & Bradstreet). Annual fee: US$99, paid by the shop.
- **Google Play Console**, as an organization. One-time fee: US$25.
- **Add the operator as an admin** on both: in App Store Connect, Users and Access, role Admin (and access to Certificates, Identifiers & Profiles); in Play Console, Users and permissions, Admin. That lets us build, sign and submit without the shop's passwords.
- **A support email and a privacy policy URL** for the store listings. The privacy policy names the shop as a recipient of customer data under consent.

## 2. Collect the shop's material

| Item | Spec |
|---|---|
| App name | As it should appear under the icon (about 12 characters show in full) |
| Bundle ID and package | Reverse domain the shop controls, e.g. `ca.shopname.app`. Can't change after the first release |
| URL scheme | Lowercase, unique per app, e.g. `shopname` |
| Accent colour | Hex. Must reach 4.5:1 against its text colour; the scaffold script and the portal check this |
| `icon.png` | 1024 × 1024, no transparency |
| `android-icon-foreground.png`, `android-icon-background.png`, `android-icon-monochrome.png` | 1024 × 1024 adaptive icon layers; keep the logo inside the centre 66% |
| `splash-icon.png` | Logo on a transparent background, shown at 76 pt wide on `splashBackground` |
| `favicon.png` | 48 × 48, web testing only |
| `expo.icon` (optional) | An Icon Composer file for iOS; without one, iOS uses `icon.png` |
| Profile | Address, coordinates, phone, email, opening hours, booking and website links |
| Store listing | Description in English and French, screenshots, support URL, privacy policy URL |
| Staff | Email address and role (`owner` or `staff`) for everyone who needs the portal |

## 3. Create the shop in Supabase

In the Supabase SQL editor (runs with the service role), on the production project in the Canada region:

```sql
insert into public.tenants (slug, name, phone, email, address, latitude, longitude, hours, booking_url, website_url)
values ('shop-slug', 'Shop Name', '+1 416-555-0100', 'service@shop.ca', '1 Main St, Toronto, ON M5V 1A1',
        43.65, -79.38,
        '[{"day":1,"opens":"08:00","closes":"18:00"}]'::jsonb,
        'https://shop.ca/book', 'https://shop.ca')
returning id;
```

The slug must match the tenant folder (lowercase letters, digits and single hyphens). `hours` days run 0 (Sunday) to 6. Staff can fill the brand and profile in the portal later.

Staff accounts: the portal never creates accounts, so add each person in Authentication → Users → Add user (email, auto-confirm), then:

```sql
insert into public.tenant_staff (tenant_id, user_id, role)
select '<tenant id>', id, 'owner' from auth.users where email = 'owner@shop.ca';
```

Staff management in the portal is not built yet; repeat this when a shop adds or removes someone (`delete from public.tenant_staff ...`).

## 4. Scaffold the app

```bash
node scripts/new-tenant.ts shop-slug --name "Shop Name" \
  --ios-bundle-id ca.shopname.app --android-package ca.shopname.app \
  --scheme shopname --accent "#RRGGBB" --splash "#1A1D21"
```

This creates `tenants/shop-slug/tenant.json`, copies placeholder images into `tenants/shop-slug/assets/` and adds `shop-slug-development`, `shop-slug-preview` and `shop-slug-production` profiles to `eas.json`. Then:

1. Replace the placeholder PNGs with the shop's artwork.
2. Optionally add `tenants/shop-slug/profile.json` (a `tenant_profiles` row, see `tenants/demo-shop/profile.json`) so a fresh install shows the shop's details before it first goes online.
3. Check the result: `TENANT=shop-slug npx expo config --type public` should show the shop's name, IDs, icons and scheme.
4. Try it locally: `TENANT=shop-slug npm run web` (light and dark mode, the "Your shop" tab, the consent prompt after sign-in).
5. Open a PR with the folder and the `eas.json` change, like any other change.

## 5. Sign-in providers

Each shop's app adds to the shared Supabase project's auth settings:

- **Email code:** the Magic Link and Confirm signup templates must include `{{ .Token }}` (already set once; `supabase/templates/sign-in-code.html` is the bilingual template). Use custom SMTP in production; Supabase's built-in sender is heavily rate-limited.
- **Apple** (build with `EXPO_PUBLIC_APPLE_SIGN_IN=true`): turn on the Sign in with Apple capability for the new bundle ID (EAS syncs capabilities on build) and add the bundle ID to Authentication → Providers → Apple → Client IDs.
- **Google** (if `EXPO_PUBLIC_GOOGLE_SIGN_IN` is on): add `shopname://auth-callback` to Authentication → URL Configuration → Redirect URLs. Guideline 4.8 means Apple sign-in must ship on iOS whenever Google does.

## 6. Build and submit

Each shop's app is its own EAS project, signed with the shop's Apple team and published to the shop's Play account.

```bash
TENANT=shop-slug npx eas-cli@latest init          # link or create the shop's EAS project
npx eas-cli@latest build --profile shop-slug-preview --platform all     # internal test build
npx eas-cli@latest build --profile shop-slug-production --platform all
npx eas-cli@latest submit --profile production --platform ios          # to the shop's App Store Connect
npx eas-cli@latest submit --profile production --platform android      # to the shop's Play Console
```

When EAS asks for Apple credentials, sign in as the operator and pick the shop's team. For Play, create the app in the shop's Play Console first and give EAS a service-account key from that account.

Gap to close before the first shop build: `app.config.ts` doesn't set a per-tenant `extra.eas.projectId`, and both EAS Build and remote push need it (`eas init` can't write into a dynamic config). Without it a shop's app gets no push token, so its customers never show up as phones in the portal's Messages preview. Add the project ID to the tenant's config and have `app.config.ts` pass it through.

JS-only fixes later ship to every shop with EAS Update on each shop's channel (`shop-slug` for production). New native code or new assets need a new store build.

Before the first public release: a TestFlight and Play internal test with a few of the shop's real customers (sign in, share, log a service in the portal, see it on the phone after sync, send a test message).

## 7. Hand over

- Send staff the portal address. They sign in with an email code, then set the logo, accent, hours and links on the Brand page; changes reach the app without a store update.
- Explain the consent model: the shop sees only customers who agreed to share in the shop's app, shown as "Customer since <date>", and a customer can revoke at any time.
- Explain messages: 4 sends in any 30 days. Promotions reach only customers who opted in to them (see Privacy); reminders about service due on their own vehicle don't need that opt-in.
- Invoice the shop.

## Suspending or removing a shop

`update public.tenants set status = 'suspended' where slug = 'shop-slug';` hides its profile from the app and blocks messages and new push registrations. It does **not** remove staff access to customer data yet (open follow-up in `docs/architecture.md`), so also delete the shop's `tenant_staff` rows. Remove the app from sale in the shop's store accounts.

## Privacy

The consumer privacy policy is PIPEDA-aligned; white-label shops add:

- **Consent:** a customer's data reaches a shop only after they agree in that shop's app. It is a separate agreement per shop, recorded in `customer_links` with the time, and revocable in Settings; revoking stops access at once. Without consent the shop sees nothing, not even that the person uses its app.
- **What the shop sees:** the customer's vehicles, service history, custom intervals and saved shops, and when they started sharing. Not their name, email or location.
- **Data-processing agreement** with every shop before go-live: the shop uses the data only to service the customer's vehicles and contact them about it, keeps staff access to people who need it, tells us about any breach, and stops using the data when the customer revokes or the contract ends.
- **CASL:** promotions are commercial electronic messages and need the customer's explicit opt-in to promotions, separate from consent to share data; each one names the shop and can be turned off in the app. Service reminders about the customer's own vehicle are a separate category. The promotions opt-in isn't built yet (open follow-up in `docs/architecture.md`).
- **Region:** one Supabase project in the Canada (Central) region for all shops; shop data, logos and push tokens stay there. Expo's push service relays message text and push tokens; name it as a service provider in the policy.
- **Each shop's store listing** carries its own privacy policy URL and App Privacy / Data safety answers, which must match ours.
