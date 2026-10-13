# Car Maintenance

A free mobile app for Canadian car owners: keep every vehicle's service history, learn what your car actually needs, get reminded before maintenance is due, and find a nearby shop.

Built with Expo (React Native) and Supabase. See [docs/requirements.md](docs/requirements.md) for scope and [docs/architecture.md](docs/architecture.md) for how it fits together.

## Run it

```bash
npm install
npx expo start
```

Scan the QR code with the Expo Go app on your phone. Sign-in and sync need a Supabase project: copy `.env.example` to `.env.local` and fill it in. Nearby shop search needs a Google Places key in the same file. Everything else works without either.

## Run it without installing anything

If your computer can't install packages (for example a work laptop behind a company npm registry), use a GitHub Codespace:

1. Open https://codespaces.new/jaimepokhoy/car-maintenance and click **Create codespace**. It installs everything in the cloud.
2. In the terminal at the bottom, run `npm run tunnel`.
3. Scan the QR code with your phone (Camera app on iPhone, Expo Go on Android).

## Checks

```bash
npm run check   # typecheck, lint, unit tests
```
