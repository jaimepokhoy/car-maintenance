/**
 * The CampaignStore backed by Supabase with the service role, which bypasses
 * RLS. The handler checks that the caller is the shop's staff before using
 * anything here on their behalf.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  CAMPAIGN_LIMIT,
  CAMPAIGN_STALE_MINUTES,
  CAMPAIGN_WINDOW_HOURS,
  type AudienceInterval,
  type AudienceVehicle,
} from '../../../src/domain/campaigns.ts';
import type { MaintenanceItemId, Powertrain, ServiceRecord } from '../../../src/domain/types.ts';
import type { CampaignStore } from './handler.ts';

/** The API returns at most 1,000 rows per request (`max_rows`). */
const PAGE_SIZE = 1000;
/** Keeps `in.(…)` filters well under URL length limits. */
const IDS_PER_REQUEST = 100;

type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

async function readAll<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error || !data) throw error ?? new Error('No data');
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

async function readByIds<T>(ids: string[], page: (ids: string[], from: number, to: number) => Page<T>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += IDS_PER_REQUEST) {
    const chunk = ids.slice(i, i + IDS_PER_REQUEST);
    out.push(...(await readAll((from, to) => page(chunk, from, to))));
  }
  return out;
}

function check(error: unknown) {
  if (error) throw error;
}

export function supabaseStore(admin: SupabaseClient): CampaignStore {
  return {
    async userForToken(jwt) {
      const { data, error } = await admin.auth.getUser(jwt);
      return error ? null : (data.user?.id ?? null);
    },

    async isStaff(tenantId, userId) {
      const { data, error } = await admin
        .from('tenant_staff')
        .select('user_id, tenants!inner(status)')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .eq('tenants.status', 'active')
        .maybeSingle();
      check(error);
      return data !== null;
    },

    async linkedCustomerIds(tenantId) {
      const rows = await readAll<{ user_id: string }>((from, to) =>
        admin
          .from('customer_links')
          .select('user_id')
          .eq('tenant_id', tenantId)
          .is('revoked_at', null)
          .is('deleted_at', null)
          .order('id')
          .range(from, to),
      );
      return rows.map((row) => row.user_id);
    },

    async dueInputs(customerIds) {
      const vehicleRows = await readByIds<{ id: string; user_id: string; powertrain: Powertrain; odometer_km: number }>(
        customerIds,
        (ids, from, to) =>
          admin
            .from('vehicles')
            .select('id, user_id, powertrain, odometer_km')
            .in('user_id', ids)
            .is('deleted_at', null)
            .order('id')
            .range(from, to),
      );
      const vehicleIds = vehicleRows.map((row) => row.id);
      const recordRows = await readByIds<{
        id: string;
        vehicle_id: string;
        item_ids: string[];
        performed_on: string;
        odometer_km: number;
      }>(vehicleIds, (ids, from, to) =>
        admin
          .from('service_records')
          .select('id, vehicle_id, item_ids, performed_on, odometer_km')
          .in('vehicle_id', ids)
          .is('deleted_at', null)
          .order('id')
          .range(from, to),
      );
      const intervalRows = await readByIds<{
        vehicle_id: string;
        item_id: string;
        every_km: number | null;
        every_months: number | null;
      }>(vehicleIds, (ids, from, to) =>
        admin
          .from('maintenance_intervals')
          .select('vehicle_id, item_id, every_km, every_months')
          .in('vehicle_id', ids)
          .is('deleted_at', null)
          .order('vehicle_id')
          .order('item_id')
          .range(from, to),
      );

      const vehicles: AudienceVehicle[] = vehicleRows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        powertrain: row.powertrain,
        odometerKm: row.odometer_km,
      }));
      const records: ServiceRecord[] = recordRows.map((row) => ({
        id: row.id,
        vehicleId: row.vehicle_id,
        itemIds: row.item_ids as MaintenanceItemId[],
        performedOn: row.performed_on,
        odometerKm: row.odometer_km,
      }));
      const intervals: AudienceInterval[] = intervalRows.map((row) => ({
        vehicleId: row.vehicle_id,
        itemId: row.item_id as MaintenanceItemId,
        everyKm: row.every_km ?? undefined,
        everyMonths: row.every_months ?? undefined,
      }));
      return { vehicles, records, intervals };
    },

    async pushTokens(tenantId, userIds) {
      const rows = await readByIds<{ token: string; user_id: string }>(userIds, (ids, from, to) =>
        admin
          .from('push_tokens')
          .select('token, user_id')
          .eq('tenant_id', tenantId)
          .in('user_id', ids)
          .order('token')
          .range(from, to),
      );
      return rows.map((row) => ({ token: row.token, userId: row.user_id }));
    },

    async sentCampaigns(tenantId, since) {
      const { data, error } = await admin
        .from('campaigns')
        .select('sent_at, sent_count')
        .eq('tenant_id', tenantId)
        .eq('status', 'sent')
        .gt('sent_at', since);
      check(error);
      return (data ?? []).map((row) => ({ sentAt: row.sent_at as string, sentCount: row.sent_count as number | null }));
    },

    async startCampaign({ id, tenantId, campaign, createdBy, recipientCount }) {
      const { data, error } = await admin.rpc('start_campaign', {
        p_id: id,
        p_tenant_id: tenantId,
        p_title: campaign.title,
        p_body: campaign.body,
        p_audience: campaign.audience,
        p_created_by: createdBy,
        p_recipient_count: recipientCount,
        p_limit: CAMPAIGN_LIMIT,
        // Hours, not days: day intervals follow the session's DST rules and
        // could disagree with campaignAllowance by an hour.
        p_window: `${CAMPAIGN_WINDOW_HOURS} hours`,
        p_stale: `${CAMPAIGN_STALE_MINUTES} minutes`,
      });
      check(error);
      if (data !== 'started' && data !== 'duplicate' && data !== 'rate_limited') {
        throw new Error(`start_campaign returned ${String(data)}`);
      }
      return data;
    },

    async recordProgress(campaignId, { sent, failed }) {
      const { error } = await admin
        .from('campaigns')
        .update({ sent_count: sent, failed_count: failed })
        .eq('id', campaignId);
      check(error);
    },

    async logFailures(campaignId, tenantId, failures) {
      for (let i = 0; i < failures.length; i += PAGE_SIZE) {
        const { error } = await admin.from('campaign_failures').insert(
          failures.slice(i, i + PAGE_SIZE).map((failure) => ({
            campaign_id: campaignId,
            tenant_id: tenantId,
            user_id: failure.userId,
            error: failure.error,
            message: failure.message,
          })),
        );
        check(error);
      }
    },

    async deleteTokens(tokens) {
      for (let i = 0; i < tokens.length; i += IDS_PER_REQUEST) {
        const { error } = await admin.from('push_tokens').delete().in('token', tokens.slice(i, i + IDS_PER_REQUEST));
        check(error);
      }
    },
  };
}
