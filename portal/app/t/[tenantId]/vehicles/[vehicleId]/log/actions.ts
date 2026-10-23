'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { canadianToday, scheduleFor } from '@/lib/customers';
import { loadVehicle } from '@/lib/customers-data';
import { type ServiceLogError, type ServiceLogField, parseServiceLog } from '@/lib/service-log';
import { createClient } from '@/lib/supabase/server';

export type LogState =
  | { status: 'idle' }
  | { status: 'invalid'; errors: Partial<Record<ServiceLogField, ServiceLogError>> }
  | { status: 'failed' };

/** A Postgres unique violation: this form's record id is already saved. */
const DUPLICATE = '23505';

/**
 * Inserts a service record on the customer's vehicle, owned by the customer
 * and marked as this shop's. RLS only accepts it while the customer is linked
 * to the shop and the user is its staff.
 */
export async function logService(
  tenantId: string,
  vehicleId: string,
  _previous: LogState,
  form: FormData,
): Promise<LogState> {
  const supabase = await createClient();
  if (!supabase) return { status: 'failed' };

  const detail = await loadVehicle(supabase, tenantId, vehicleId);
  if (!detail) return { status: 'failed' };

  const parsed = parseServiceLog(form, {
    tenantId,
    userId: detail.vehicle.user_id,
    vehicleId,
    allowedItemIds: scheduleFor(detail.vehicle, detail.intervals).map((interval) => interval.itemId),
    today: canadianToday(),
  });
  if (!parsed.ok) return { status: 'invalid', errors: parsed.errors };

  const { error } = await supabase.from('service_records').insert(parsed.record);
  // A double submit re-sends the same id; the first one already saved it.
  if (error && error.code !== DUPLICATE) return { status: 'failed' };

  revalidatePath(`/t/${tenantId}/customers`);
  revalidatePath(`/t/${tenantId}/vehicles/${vehicleId}`);
  redirect(`/t/${tenantId}/vehicles/${vehicleId}?logged=1`);
}
