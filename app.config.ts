import fs from 'node:fs';
import path from 'node:path';

import type { ConfigContext, ExpoConfig } from 'expo/config';

// Node strips the types when loading this import (Node 22.18+), so tenant.ts
// must keep to erasable syntax: no enums or namespaces.
import { DEFAULT_TENANT_SLUG, isTenantSlug, validateTenantConfig } from './src/domain/tenant.ts';

/**
 * One codebase, one app per shop. `TENANT` picks a folder in `tenants/` (the
 * unbranded consumer app when unset); its `tenant.json` and `assets/` set the
 * store identity. `npx expo config --type public` shows the result.
 */
const slug = process.env.TENANT ?? DEFAULT_TENANT_SLUG;
if (!isTenantSlug(slug)) {
  throw new Error(`TENANT="${slug}" is not a tenant slug (lowercase letters, digits and single hyphens)`);
}
const tenantDir = path.join(__dirname, 'tenants', slug);
const tenantFile = path.join(tenantDir, 'tenant.json');
if (!fs.existsSync(tenantFile)) {
  throw new Error(`TENANT=${slug}: ${tenantFile} not found. Scaffold it with: node scripts/new-tenant.ts ${slug}`);
}
const result = validateTenantConfig(JSON.parse(fs.readFileSync(tenantFile, 'utf8')));
if (!result.ok) {
  throw new Error(`Invalid ${tenantFile}:\n- ${result.errors.join('\n- ')}`);
}
const tenant = result.config;
if (tenant.slug !== slug) {
  throw new Error(`${tenantFile} has slug "${tenant.slug}" but lives in tenants/${slug}/`);
}

// The shop's details as of the build (name, contact, hours), so a branded app
// works offline before it first reaches Supabase. Shape: a `tenant_profiles` row.
const profileFile = path.join(tenantDir, 'profile.json');
const tenantProfile = fs.existsSync(profileFile) ? JSON.parse(fs.readFileSync(profileFile, 'utf8')) : null;
if (tenantProfile && tenantProfile.slug !== slug) {
  throw new Error(`${profileFile} has slug "${tenantProfile.slug}" but lives in tenants/${slug}/`);
}

const asset = (name: string) => `./tenants/${slug}/assets/${name}`;
const iosIcon = fs.existsSync(path.join(tenantDir, 'assets', 'expo.icon')) ? asset('expo.icon') : asset('icon.png');
/** Only shows when an adaptive icon has no background image. */
const ANDROID_ICON_FALLBACK_BACKGROUND = '#E6F4FE';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: tenant.appName,
  slug: slug === DEFAULT_TENANT_SLUG ? 'car-maintenance' : slug,
  version: '1.0.0',
  orientation: 'portrait',
  icon: asset('icon.png'),
  scheme: tenant.scheme,
  userInterfaceStyle: 'automatic',
  ios: {
    icon: iosIcon,
    ...(tenant.iosBundleId ? { bundleIdentifier: tenant.iosBundleId } : {}),
  },
  android: {
    ...(tenant.androidPackage ? { package: tenant.androidPackage } : {}),
    adaptiveIcon: {
      backgroundColor: ANDROID_ICON_FALLBACK_BACKGROUND,
      foregroundImage: asset('android-icon-foreground.png'),
      backgroundImage: asset('android-icon-background.png'),
      monochromeImage: asset('android-icon-monochrome.png'),
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: tenant.splashBackground,
        image: asset('splash-icon.png'),
        imageWidth: 76,
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: `${tenant.appName} uses your location to find repair shops near you.`,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
    // Set by the GitHub Pages workflow, which serves the web build under /<repo>.
    ...(process.env.WEB_BASE_URL ? { baseUrl: process.env.WEB_BASE_URL } : {}),
  },
  platforms: ['ios', 'android', 'web'],
  web: {
    output: 'single',
    favicon: asset('favicon.png'),
  },
  extra: {
    ...config.extra,
    tenant,
    ...(tenantProfile ? { tenantProfile } : {}),
  },
});
