import Constants from 'expo-constants';

import { parseTenantProfile, type TenantProfile } from '@/domain/brand';
import { DEFAULT_TENANT_SLUG, validateTenantConfig, type TenantConfig } from '@/domain/tenant';
import defaultTenant from '../../tenants/default/tenant.json';

/**
 * The shop this binary was built for, from `tenants/<slug>/tenant.json` via
 * `app.config.ts` (`extra.tenant`). Falls back to the unbranded default when
 * the embedded config is missing, e.g. in tests.
 */
export const bundledTenant: TenantConfig = readBundledTenant();

/** True in a shop's own app, false in the unbranded consumer app. */
export const isBrandedBuild: boolean = bundledTenant.slug !== DEFAULT_TENANT_SLUG;

/**
 * The shop's details as of the build, from `tenants/<slug>/profile.json`
 * (`extra.tenantProfile`), so its app shows them offline before it first
 * reaches Supabase. Just the app name when the tenant has no profile file;
 * null in the unbranded app.
 */
export const bundledProfile: TenantProfile | null = isBrandedBuild ? readBundledProfile() : null;

function readBundledTenant(): TenantConfig {
  const result = validateTenantConfig(Constants.expoConfig?.extra?.tenant);
  return result.ok ? result.config : (defaultTenant as TenantConfig);
}

function readBundledProfile(): TenantProfile {
  const profile = parseTenantProfile(Constants.expoConfig?.extra?.tenantProfile);
  if (profile?.slug === bundledTenant.slug) return profile;
  return {
    slug: bundledTenant.slug,
    name: bundledTenant.appName,
    brand: {},
    phone: null,
    email: null,
    address: null,
    latitude: null,
    longitude: null,
    hours: null,
    booking_url: null,
    website_url: null,
    updated_at: new Date(0).toISOString(),
  };
}
