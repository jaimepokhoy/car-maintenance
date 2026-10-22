import { type IsoDate, type MaintenanceItemId, type ServiceFormError, validateServiceForm } from './domain';

/** A `service_records` row written by a shop. */
export type ShopServiceRecordInsert = {
  id: string;
  user_id: string;
  vehicle_id: string;
  item_ids: MaintenanceItemId[];
  performed_on: IsoDate;
  odometer_km: number;
  cost_cents: number | null;
  currency: 'CAD' | null;
  notes: string | null;
  created_by_tenant_id: string;
};

export type ServiceLogField = 'id' | 'itemIds' | 'performedOn' | 'odometerKm' | 'cost' | 'notes';

export type ServiceLogError = ServiceFormError | 'invalidId' | 'unknownItem' | 'invalidDate' | 'notesTooLong';

export type ServiceLogParse =
  | { ok: true; record: ShopServiceRecordInsert }
  | { ok: false; errors: Partial<Record<ServiceLogField, ServiceLogError>> };

export type ServiceLogContext = {
  tenantId: string;
  /** The customer who owns the vehicle; the record stays theirs. */
  userId: string;
  vehicleId: string;
  /** Items in the vehicle's schedule; nothing else can be logged. */
  allowedItemIds: readonly MaintenanceItemId[];
  today: IsoDate;
};

export const MAX_NOTES_LENGTH = 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates the Log a service form with the app's own rules
 * (`validateServiceForm`: at least one item, no future date, whole-number
 * kilometres, money to integer cents) and builds the row. `id` is generated
 * when the form is rendered, so submitting twice can't log the service twice.
 */
export function parseServiceLog(form: FormData, context: ServiceLogContext): ServiceLogParse {
  const text = (key: string) => String(form.get(key) ?? '').trim();
  const errors: Partial<Record<ServiceLogField, ServiceLogError>> = {};

  const id = text('id').toLowerCase();
  if (!UUID.test(id)) errors.id = 'invalidId';

  const allowed = new Set<string>(context.allowedItemIds);
  const itemIds = form.getAll('itemIds').map(String);
  const unknown = itemIds.some((item) => !allowed.has(item));

  const performedOn = text('performedOn');
  const notes = text('notes');

  const result = validateServiceForm(
    {
      itemIds: itemIds as MaintenanceItemId[],
      performedOn,
      odometerKm: text('odometerKm'),
      cost: text('cost'),
      notes,
    },
    context.today,
  );
  if (!result.ok) Object.assign(errors, result.errors);

  if (unknown) errors.itemIds = 'unknownItem';
  if (!isCalendarDate(performedOn)) errors.performedOn = 'invalidDate';
  if (notes.length > MAX_NOTES_LENGTH) errors.notes = 'notesTooLong';

  if (!result.ok || Object.keys(errors).length > 0) return { ok: false, errors };

  const { value } = result;
  return {
    ok: true,
    record: {
      id,
      user_id: context.userId,
      vehicle_id: context.vehicleId,
      item_ids: value.itemIds,
      performed_on: value.performedOn,
      odometer_km: value.odometerKm,
      cost_cents: value.costCents ?? null,
      currency: value.costCents === undefined ? null : 'CAD',
      notes: value.notes ?? null,
      created_by_tenant_id: context.tenantId,
    },
  };
}

/** A real `YYYY-MM-DD` date (not 2026-02-30). */
function isCalendarDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) && value >= '1900-01-01';
}
