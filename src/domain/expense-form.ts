import { parseMoneyToCents } from './service-form';
import type { DistanceUnit, ExpenseCategory, IsoDate } from './types';
import { displayToKm } from './units';
import { parseWholeNumber } from './vehicle-form';

export interface ExpenseFormValues {
  category: ExpenseCategory;
  incurredOn: IsoDate;
  amount: string;
  /** Blank means the owner didn't note the reading. */
  odometerKm: string;
  notes: string;
}

export interface ValidExpense {
  category: ExpenseCategory;
  incurredOn: IsoDate;
  amountCents: number;
  odometerKm?: number;
  notes?: string;
}

export type ExpenseFormError =
  | 'futureDate'
  | 'required'
  | 'invalidAmount'
  | 'invalidOdometer';

export type ExpenseFormResult =
  | { ok: true; value: ValidExpense }
  | { ok: false; errors: Partial<Record<keyof ExpenseFormValues, ExpenseFormError>> };

const MAX_ODOMETER_KM = 2_000_000;

/**
 * Validates an expense. Unlike a service, the amount is required: a fuel fill
 * with no price is a note, not a cost. The odometer is optional, and is
 * returned in kilometres.
 */
export function validateExpenseForm(
  values: ExpenseFormValues,
  today: IsoDate,
  unit: DistanceUnit = 'km',
): ExpenseFormResult {
  const errors: Partial<Record<keyof ExpenseFormValues, ExpenseFormError>> = {};

  if (values.incurredOn > today) errors.incurredOn = 'futureDate';

  const amount = values.amount.trim() ? parseMoneyToCents(values.amount) : null;
  if (!values.amount.trim()) errors.amount = 'required';
  else if (amount === null) errors.amount = 'invalidAmount';

  let odometerKm: number | undefined;
  const entered = values.odometerKm.trim();
  if (entered) {
    const whole = parseWholeNumber(entered);
    if (whole === null || Math.round(displayToKm(whole, unit)) > MAX_ODOMETER_KM) {
      errors.odometerKm = 'invalidOdometer';
    } else {
      odometerKm = Math.round(displayToKm(whole, unit));
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      category: values.category,
      incurredOn: values.incurredOn,
      amountCents: amount!,
      odometerKm,
      notes: values.notes.trim() || undefined,
    },
  };
}
