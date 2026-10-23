import { randomUUID } from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';

import { ensureTenantShop } from '@/db/shops';
import type { TenantProfile } from '@/domain/brand';
import { useTenant } from '@/hooks/use-tenant';
import { bundledProfile, isBrandedBuild } from '@/lib/tenant-config';

/** The shop whose app this is: its live profile, or the one bundled with the build. Null in the unbranded app. */
export function useShopProfile(): TenantProfile | null {
  const { profile } = useTenant();
  return isBrandedBuild ? (profile ?? bundledProfile) : null;
}

/** One save at a time, so the bundled and then the live profile can't both insert the shop. */
let saving: Promise<unknown> = Promise.resolve();

/**
 * Keeps a branded app's own shop in the local `shops` table as a saved shop,
 * so services can be linked to it. Does nothing in the unbranded app.
 */
export function useSaveTenantShop() {
  const db = useSQLiteContext();
  const shop = useShopProfile();

  useEffect(() => {
    if (!shop) return;
    const details = {
      name: shop.name,
      address: shop.address ?? undefined,
      phone: shop.phone ?? undefined,
      latitude: shop.latitude ?? undefined,
      longitude: shop.longitude ?? undefined,
    };
    saving = saving
      .then(() => ensureTenantShop(db, randomUUID(), shop.slug, details, new Date()))
      .catch((error) => console.warn('Saving the shop failed', error));
  }, [db, shop]);
}
