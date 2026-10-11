import { parseWholeNumber } from './vehicle-form';
import type { IsoDate, MaintenanceItemId } from './types';

export interface ServiceFormValues {
  itemIds: MaintenanceItemId[];
  performedOn: IsoDate;
  odometerKm: string;
  cost: string;
  notes: string;
}

export interface ValidService {
  itemIds: MaintenanceItemId[];
  performedOn: IsoDate;
  odometerKm: number;
  costCents?: number;
  notes?: string;
}

export type ServiceFormError =
  | 'noItems'
  | 'futureDate'
  | 'required'
  | 'invalidOdometer'
  | 'invalidCost';

export type ServiceFormResult =
  | { ok: true; value: ValidService }
  | { ok: false; errors: Partial<Record<keyof ServiceFormValues, ServiceFormError>> };

const MAX_ODOMETER_KM = 2_000_000;

/** Parses "89.99", "89,99" (French) or "$1,234.50" into cents. */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.replace(/[$\s  ]/g, '');
  if (!cleaned) return null;
  // A comma followed by exactly two digits at the end is a French decimal separator.
  const normalized = /,\d{2}$/.test(cleaned) && !cleaned.includes('.')
    ? cleaned.replace(/,(?=\d{2}$)/, '.').replace(/,/g, '')
    : cleaned.replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

export function validateServiceForm(values: ServiceFormValues, today: IsoDate): ServiceFormResult {
  const errors: Partial<Record<keyof ServiceFormValues, ServiceFormError>> = {};

  if (values.itemIds.length === 0) errors.itemIds = 'noItems';
  if (values.performedOn > today) errors.performedOn = 'futureDate';

  const odometerKm = parseWholeNumber(values.odometerKm);
  if (!values.odometerKm.trim()) errors.odometerKm = 'required';
  else if (odometerKm === null || odometerKm > MAX_ODOMETER_KM) errors.odometerKm = 'invalidOdometer';

  const costCents = values.cost.trim() ? parseMoneyToCents(values.cost) : undefined;
  if (costCents === null) errors.cost = 'invalidCost';

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      itemIds: [...new Set(values.itemIds)],
      performedOn: values.performedOn,
      odometerKm: odometerKm!,
      costCents: costCents ?? undefined,
      notes: values.notes.trim() || undefined,
    },
  };
}
