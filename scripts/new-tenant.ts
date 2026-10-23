/**
 * Scaffolds a shop's app: `tenants/<slug>/` (tenant.json + placeholder assets
 * copied from the default tenant) and its development/preview/production
 * profiles in eas.json.
 *
 * Usage (Node 22.18+ runs the TypeScript directly):
 *
 *   node scripts/new-tenant.ts <slug> --name "Shop Name" \
 *     --ios-bundle-id ca.shop.app --android-package ca.shop.app \
 *     [--scheme shopapp] [--accent "#RRGGBB"] [--on-accent "#RRGGBB"] [--splash "#RRGGBB"]
 *
 * Then replace the PNGs in tenants/<slug>/assets/ with the shop's artwork and
 * check the result with `TENANT=<slug> npx expo config --type public`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { isTenantSlug, validateTenantConfig, type TenantConfig } from '../src/domain/tenant.ts';

const root = path.join(import.meta.dirname, '..');
const tenantsDir = path.join(root, 'tenants');
const ASSETS = [
  'icon.png',
  'android-icon-foreground.png',
  'android-icon-background.png',
  'android-icon-monochrome.png',
  'splash-icon.png',
  'favicon.png',
];
const PROFILES = ['development', 'preview', 'production'] as const;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    name: { type: 'string' },
    'ios-bundle-id': { type: 'string' },
    'android-package': { type: 'string' },
    scheme: { type: 'string' },
    accent: { type: 'string' },
    'on-accent': { type: 'string' },
    splash: { type: 'string' },
  },
});

const slug = positionals[0];
if (!slug || !isTenantSlug(slug)) fail('Usage: node scripts/new-tenant.ts <slug> --name "Shop Name" ... (see file header)');
const tenantDir = path.join(tenantsDir, slug);
if (fs.existsSync(tenantDir)) fail(`tenants/${slug} already exists`);

const defaults = JSON.parse(fs.readFileSync(path.join(tenantsDir, 'default', 'tenant.json'), 'utf8')) as TenantConfig;
const config = {
  slug,
  appName: values.name,
  iosBundleId: values['ios-bundle-id'],
  androidPackage: values['android-package'],
  scheme: values.scheme ?? slug.replaceAll('-', ''),
  accent: values.accent ?? defaults.accent,
  onAccent: values['on-accent'],
  splashBackground: values.splash ?? defaults.splashBackground,
  easUpdateChannel: slug,
};
const result = validateTenantConfig(JSON.parse(JSON.stringify(config)));
if (!result.ok) fail(`Invalid tenant:\n- ${result.errors.join('\n- ')}`);

fs.mkdirSync(path.join(tenantDir, 'assets'), { recursive: true });
fs.writeFileSync(path.join(tenantDir, 'tenant.json'), `${JSON.stringify(result.config, null, 2)}\n`);
for (const asset of ASSETS) {
  fs.copyFileSync(path.join(tenantsDir, 'default', 'assets', asset), path.join(tenantDir, 'assets', asset));
}

const easFile = path.join(root, 'eas.json');
const eas = JSON.parse(fs.readFileSync(easFile, 'utf8'));
for (const profile of PROFILES) {
  eas.build[`${slug}-${profile}`] = {
    extends: profile,
    channel: profile === 'production' ? slug : `${slug}-${profile}`,
    env: { TENANT: slug },
  };
}
fs.writeFileSync(easFile, `${JSON.stringify(eas, null, 2)}\n`);

console.log(`Created tenants/${slug}/ and eas.json profiles ${PROFILES.map((p) => `${slug}-${p}`).join(', ')}.`);
console.log('Replace the placeholder assets, then run: TENANT=' + slug + ' npx expo config --type public');
