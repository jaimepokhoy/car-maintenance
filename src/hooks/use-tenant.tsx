import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { DefaultBrand } from '@/constants/theme';
import { getCachedTenantProfile, setCachedTenantProfile } from '@/db/settings';
import { resolveBrand, type BrandOverlay, type TenantProfile } from '@/domain/brand';
import type { TenantConfig } from '@/domain/tenant';
import { supabase } from '@/lib/supabase';
import { bundledTenant, isBrandedBuild } from '@/lib/tenant-config';
import { fetchTenantProfile } from '@/lib/tenant-profile';

interface TenantContextValue {
  /** Build-time identity from `tenant.json`. */
  config: TenantConfig;
  /** The shop's live profile, cached on device; always null in the unbranded app. */
  profile: TenantProfile | null;
  /** The accent role `useTheme()` lays over Night Drive. */
  brand: BrandOverlay;
}

const TenantContext = createContext<TenantContextValue>({ config: bundledTenant, profile: null, brand: DefaultBrand });

/**
 * Loads the shop's cached profile, then refreshes it from Supabase when it is
 * configured. A branded app holds its first render until the cache is read so
 * it never flashes the bundled accent; the unbranded app reads nothing and
 * makes no network call.
 */
export function TenantProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [ready, setReady] = useState(!isBrandedBuild);

  useEffect(() => {
    if (!isBrandedBuild) return;
    let active = true;

    (async () => {
      const cached = await getCachedTenantProfile(db).catch(() => null);
      if (!active) return;
      // The web build shares one database across tenants on the same origin.
      if (cached?.slug === bundledTenant.slug) setProfile(cached);
      setReady(true);

      if (!supabase) return;
      const result = await fetchTenantProfile(supabase, bundledTenant.slug);
      if (!active || !result.ok) return;
      setProfile(result.profile);
      await setCachedTenantProfile(db, result.profile).catch(() => {});
    })();

    return () => {
      active = false;
    };
  }, [db]);

  const value = useMemo(
    () => ({ config: bundledTenant, profile, brand: resolveBrand(bundledTenant, profile) }),
    [profile],
  );

  if (!ready) return null;
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  return useContext(TenantContext);
}
