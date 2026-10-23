import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef } from 'react';

import { cacheTenantNames, isConsentDeclined, listCustomerLinks, unnamedTenantIds } from '@/db/customer-links';
import { shouldAskConsent } from '@/domain';
import { useSession } from '@/hooks/use-session';
import { useSync } from '@/hooks/use-sync';
import { useTenant } from '@/hooks/use-tenant';
import { supabase } from '@/lib/supabase';
import { isBrandedBuild } from '@/lib/tenant-config';
import { fetchTenantNames } from '@/lib/tenant-names';

/**
 * Keeps shop names on the device for "Shared with" and "Logged by": this
 * app's own shop from its live profile, and any other shop a link or a
 * shop-logged service mentions, fetched after each sync.
 */
export function useTenantNameSync() {
  const db = useSQLiteContext();
  const { profile } = useTenant();
  const { revision, lastSyncedAt } = useSync();

  useEffect(() => {
    if (profile?.id) cacheTenantNames(db, [{ id: profile.id, name: profile.name }]).catch(() => {});
  }, [db, profile]);

  useEffect(() => {
    const client = supabase;
    if (!client || !lastSyncedAt) return;
    (async () => {
      const missing = await unnamedTenantIds(db);
      await cacheTenantNames(db, await fetchTenantNames(client, missing));
    })().catch((error) => console.warn('Could not load shop names', error));
  }, [db, revision, lastSyncedAt]);
}

/**
 * In a shop's app, opens the consent screen once after sign-in, when the
 * first sync has finished and the customer hasn't answered for this shop yet.
 */
export function useConsentPrompt() {
  const db = useSQLiteContext();
  const userId = useSession().session?.user.id;
  const { lastSyncedAt } = useSync();
  const tenantId = useTenant().profile?.id ?? null;
  const asked = useRef<string | null>(null);
  // When the account appeared, the last sync may have been for whoever used the
  // phone before; only a sync finished since then has pulled this account's links.
  const baseline = useRef<{ userId: string; at: string | null } | null>(null);

  useEffect(() => {
    if (!userId) return;
    if (baseline.current?.userId !== userId) baseline.current = { userId, at: lastSyncedAt };
    if (!isBrandedBuild || !tenantId || asked.current === userId) return;
    let active = true;
    (async () => {
      const ask = shouldAskConsent({
        branded: isBrandedBuild,
        signedIn: true,
        synced: lastSyncedAt !== null && lastSyncedAt !== baseline.current?.at,
        tenantId,
        links: await listCustomerLinks(db),
        declined: await isConsentDeclined(db, tenantId),
      });
      if (!active || !ask) return;
      asked.current = userId;
      router.push('/consent');
    })().catch((error) => console.warn('Could not check sharing consent', error));
    return () => {
      active = false;
    };
  }, [db, userId, tenantId, lastSyncedAt]);
}
