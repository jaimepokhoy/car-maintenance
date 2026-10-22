import Constants from 'expo-constants';

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

function readBundledTenant(): TenantConfig {
  const result = validateTenantConfig(Constants.expoConfig?.extra?.tenant);
  return result.ok ? result.config : (defaultTenant as TenantConfig);
}
