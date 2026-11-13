# Car Maintenance

A free mobile app for Canadian car owners: keep every vehicle's service history, learn what your car actually needs, get reminded before maintenance is due, and find a nearby shop.

Built with Expo (React Native). Everything runs on the device — no account and no server. See [docs/requirements.md](docs/requirements.md) for scope and [docs/architecture.md](docs/architecture.md) for how it fits together.

## Run it

```bash
npm install
npx expo start
```

Scan the QR code with the Expo Go app on your phone. Nearby shop search needs a Google Places key: copy `.env.example` to `.env.local` and fill it in. Everything else works offline with nothing configured.

## Checks

```bash
npm run check   # typecheck, lint, unit tests
```
