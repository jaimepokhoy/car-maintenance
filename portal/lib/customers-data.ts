import 'server-only';

import {
  type CustomerSummary,
  INTERVAL_COLUMNS,
  type IntervalRow,
  LINK_COLUMNS,
  type LinkRow,
  RECORD_COLUMNS,
  type RecordRow,
  VEHICLE_COLUMNS,
  type VehicleRow,
  buildCustomerList,
} from './customers';
import type { IsoDate } from './domain';
import type { createClient } from './supabase/server';

type Client = NonNullable<Awaited<ReturnType<typeof createClient>>>;
type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

/** The API returns at most 1,000 rows per request (`max_rows`), so read in pages. */
const PAGE_SIZE = 1000;
/** Keeps `in.(…)` filters well under URL length limits. */
const IDS_PER_REQUEST = 100;

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
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += IDS_PER_REQUEST) chunks.push(ids.slice(i, i + IDS_PER_REQUEST));
  const results = await Promise.all(chunks.map((chunk) => readAll((from, to) => page(chunk, from, to))));
  return results.flat();
}

/**
 * The shop's linked, non-revoked customers with their vehicles and what is
 * due. Every query runs as the signed-in staff member, so RLS decides what is
 * visible; filtering by this shop's links keeps other shops' customers out
 * for staff who work at several. Null when a query fails.
 */
export async function loadCustomerList(
  supabase: Client,
  tenantId: string,
  today: IsoDate,
): Promise<CustomerSummary[] | null> {
  try {
    const links = await readAll<LinkRow>((from, to) =>
      supabase
        .from('customer_links')
        .select(LINK_COLUMNS)
        .eq('tenant_id', tenantId)
        .is('revoked_at', null)
        .is('deleted_at', null)
        .order('id')
        .range(from, to),
    );
    const userIds = links.map((link) => link.user_id);
    const vehicles = await readByIds<VehicleRow>(userIds, (ids, from, to) =>
      supabase.from('vehicles').select(VEHICLE_COLUMNS).in('user_id', ids).is('deleted_at', null).order('id').range(from, to),
    );
    const vehicleIds = vehicles.map((vehicle) => vehicle.id);
    const [records, intervals] = await Promise.all([
      readByIds<RecordRow>(vehicleIds, (ids, from, to) =>
        supabase
          .from('service_records')
          .select(RECORD_COLUMNS)
          .in('vehicle_id', ids)
          .is('deleted_at', null)
          .order('id')
          .range(from, to),
      ),
      readByIds<IntervalRow>(vehicleIds, (ids, from, to) =>
        supabase
          .from('maintenance_intervals')
          .select(INTERVAL_COLUMNS)
          .in('vehicle_id', ids)
          .is('deleted_at', null)
          .order('vehicle_id')
          .order('item_id')
          .range(from, to),
      ),
    ]);
    return buildCustomerList(links, vehicles, records, intervals, today);
  } catch {
    return null;
  }
}

export type VehicleDetail = { vehicle: VehicleRow; records: RecordRow[]; intervals: IntervalRow[] };

/**
 * One vehicle with its history and schedule overrides, or null unless its
 * owner has a live link to this shop. RLS would also show customers of the
 * staff member's other shops, so the link is checked here too.
 */
export async function loadVehicle(supabase: Client, tenantId: string, vehicleId: string): Promise<VehicleDetail | null> {
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select(VEHICLE_COLUMNS)
    .eq('id', vehicleId)
    .is('deleted_at', null)
    .maybeSingle<VehicleRow>();
  if (!vehicle) return null;

  const { data: link } = await supabase
    .from('customer_links')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', vehicle.user_id)
    .is('revoked_at', null)
    .is('deleted_at', null)
    .maybeSingle();
  if (!link) return null;

  try {
    const [records, intervals] = await Promise.all([
      readAll<RecordRow>((from, to) =>
        supabase
          .from('service_records')
          .select(RECORD_COLUMNS)
          .eq('vehicle_id', vehicleId)
          .is('deleted_at', null)
          .order('id')
          .range(from, to),
      ),
      readAll<IntervalRow>((from, to) =>
        supabase
          .from('maintenance_intervals')
          .select(INTERVAL_COLUMNS)
          .eq('vehicle_id', vehicleId)
          .is('deleted_at', null)
          .order('item_id')
          .range(from, to),
      ),
    ]);
    return { vehicle, records, intervals };
  } catch {
    return null;
  }
}
