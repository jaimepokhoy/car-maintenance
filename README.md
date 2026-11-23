# Car Maintenance

A free mobile app for Canadian car owners: keep every vehicle's service history, learn what your car actually needs, get reminded before maintenance is due, and find a nearby shop.

Built with Expo (React Native). Everything runs on the device — no account and no server. See [docs/requirements.md](docs/requirements.md) for scope and [docs/architecture.md](docs/architecture.md) for how it fits together.

## Run it

```bash
npm install
npx expo start
```

Scan the QR code with the Expo Go app on your phone. Nothing needs configuring: everything is stored on the device.

## Checks

```bash
npm run check   # typecheck, lint, unit tests
```

### Database tests

The row-level security rules in `supabase/migrations/` have pgTAP tests in `supabase/tests/`. They need Docker running.

```bash
npx supabase start     # local Postgres with every migration applied
npx supabase test db   # run supabase/tests/*.sql
npx supabase db reset  # re-apply migrations after adding one
npx supabase stop
```
