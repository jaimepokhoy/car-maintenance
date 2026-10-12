import type { Powertrain } from './types';
import { isValidVin, normalizeVin } from './vin';

export interface VehicleFormValues {
  nickname: string;
  year: string;
  make: string;
  model: string;
  vin: string;
  powertrain: Powertrain;
  odometerKm: string;
}

export interface ValidVehicle {
  nickname: string;
  year: number;
  make: string;
  model: string;
  vin?: string;
  powertrain: Powertrain;
  odometerKm: number;
}

export type VehicleFormError =
  | 'required'
  | 'invalidYear'
  | 'invalidOdometer'
  | 'invalidVin';

export type VehicleFormResult =
  | { ok: true; value: ValidVehicle }
  | { ok: false; errors: Partial<Record<keyof VehicleFormValues, VehicleFormError>> };

const MAX_ODOMETER_KM = 2_000_000;

/** Parses "85,000", "85 000" or "85000" (English or French grouping) into a whole number. */
export function parseWholeNumber(input: string): number | null {
  const digits = input.replace(/[\s,.  ]/g, '');
  return /^\d+$/.test(digits) ? Number(digits) : null;
}

export function validateVehicleForm(values: VehicleFormValues, currentYear: number): VehicleFormResult {
  const errors: Partial<Record<keyof VehicleFormValues, VehicleFormError>> = {};
  const make = values.make.trim();
  const model = values.model.trim();

  const year = parseWholeNumber(values.year);
  if (!values.year.trim()) errors.year = 'required';
  else if (year === null || year < 1950 || year > currentYear + 1) errors.year = 'invalidYear';

  if (!make) errors.make = 'required';
  if (!model) errors.model = 'required';

  const odometerKm = parseWholeNumber(values.odometerKm);
  if (!values.odometerKm.trim()) errors.odometerKm = 'required';
  else if (odometerKm === null || odometerKm > MAX_ODOMETER_KM) errors.odometerKm = 'invalidOdometer';

  const vin = normalizeVin(values.vin);
  if (vin && !isValidVin(vin)) errors.vin = 'invalidVin';

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      nickname: values.nickname.trim() || `${year} ${make} ${model}`,
      year: year!,
      make,
      model,
      vin: vin || undefined,
      powertrain: values.powertrain,
      odometerKm: odometerKm!,
    },
  };
}
