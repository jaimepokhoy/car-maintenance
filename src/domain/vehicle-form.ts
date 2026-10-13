import type { DistanceUnit, Powertrain, Vehicle } from './types';
import { displayToKm, kmToDisplay } from './units';
import { isValidVin, normalizeVin } from './vin';

export interface VehicleFormValues {
  nickname: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  vin: string;
  powertrain: Powertrain;
  odometerKm: string;
  licencePlate: string;
  tireSize: string;
}

/** Everything about a vehicle except its odometer, which has its own update flow once the car exists. */
export type VehicleDetailsValues = Omit<VehicleFormValues, 'odometerKm'>;

export interface ValidVehicleDetails {
  nickname: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  vin?: string;
  powertrain: Powertrain;
  licencePlate?: string;
  tireSize?: string;
}

export interface ValidVehicle extends ValidVehicleDetails {
  odometerKm: number;
}

export type VehicleFormError =
  | 'required'
  | 'invalidYear'
  | 'invalidOdometer'
  | 'invalidVin'
  | 'invalidPlate';

export type VehicleFormErrors = Partial<Record<keyof VehicleFormValues, VehicleFormError>>;

type Result<T> = { ok: true; value: T } | { ok: false; errors: VehicleFormErrors };

export type VehicleDetailsResult = Result<ValidVehicleDetails>;
export type VehicleFormResult = Result<ValidVehicle>;

const MAX_ODOMETER_KM = 2_000_000;

/** Parses "85,000", "85 000" or "85000" (English or French grouping) into a whole number. */
export function parseWholeNumber(input: string): number | null {
  const digits = input.replace(/[\s,.  ]/g, '');
  return /^\d+$/.test(digits) ? Number(digits) : null;
}

/** Plates are shown the way they're stamped: capitals, single spaces. */
export function normalizeLicencePlate(input: string): string {
  return input.trim().replace(/\s+/g, ' ').toUpperCase();
}

// Canadian plates are at most 8 characters; allow a little slack for spaces and dashes.
const PLATE_PATTERN = /^[A-Z0-9][A-Z0-9 -]{0,9}$/;

/** "225/45 r17" → "225/45R17". Tire sizes vary too much (load index, LT, metric) to validate strictly. */
export function normalizeTireSize(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/\s*\/\s*/g, '/')
    .replace(/(\d)\s+(Z?R)\s*(\d)/g, '$1$2$3')
    .replace(/\s+/g, ' ');
}

/** "2019 Honda Civic EX", the vehicle's description without its nickname. */
export function describeVehicle(vehicle: Pick<Vehicle, 'year' | 'make' | 'model' | 'trim'>): string {
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ');
}

/** Validates the details shared by the add and edit forms. */
export function validateVehicleDetails(values: VehicleDetailsValues, currentYear: number): VehicleDetailsResult {
  const errors: VehicleFormErrors = {};
  const make = values.make.trim();
  const model = values.model.trim();

  const year = parseWholeNumber(values.year);
  if (!values.year.trim()) errors.year = 'required';
  else if (year === null || year < 1950 || year > currentYear + 1) errors.year = 'invalidYear';

  if (!make) errors.make = 'required';
  if (!model) errors.model = 'required';

  const vin = normalizeVin(values.vin);
  if (vin && !isValidVin(vin)) errors.vin = 'invalidVin';

  const licencePlate = normalizeLicencePlate(values.licencePlate);
  if (licencePlate && !PLATE_PATTERN.test(licencePlate)) errors.licencePlate = 'invalidPlate';

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      nickname: values.nickname.trim() || `${year} ${make} ${model}`,
      year: year!,
      make,
      model,
      trim: values.trim.trim() || undefined,
      vin: vin || undefined,
      powertrain: values.powertrain,
      licencePlate: licencePlate || undefined,
      tireSize: normalizeTireSize(values.tireSize) || undefined,
    },
  };
}

/** Validates a new vehicle. `odometerKm` is entered in the owner's unit and returned in kilometres. */
export function validateVehicleForm(
  values: VehicleFormValues,
  currentYear: number,
  unit: DistanceUnit = 'km',
): VehicleFormResult {
  const details = validateVehicleDetails(values, currentYear);
  const errors: VehicleFormErrors = details.ok ? {} : { ...details.errors };

  const entered = parseWholeNumber(values.odometerKm);
  const odometerKm = entered === null ? null : Math.round(displayToKm(entered, unit));
  if (!values.odometerKm.trim()) errors.odometerKm = 'required';
  else if (odometerKm === null || odometerKm > MAX_ODOMETER_KM) errors.odometerKm = 'invalidOdometer';

  if (!details.ok || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { ...details.value, odometerKm: odometerKm! } };
}

/** Prefills the form from a saved vehicle. A nickname that is just the default is left blank so it follows edits. */
export function vehicleToFormValues(vehicle: Vehicle, unit: DistanceUnit = 'km'): VehicleFormValues {
  const defaultNickname = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  return {
    nickname: vehicle.nickname === defaultNickname ? '' : vehicle.nickname,
    year: String(vehicle.year),
    make: vehicle.make,
    model: vehicle.model,
    trim: vehicle.trim ?? '',
    vin: vehicle.vin ?? '',
    powertrain: vehicle.powertrain,
    odometerKm: String(Math.round(kmToDisplay(vehicle.odometerKm, unit))),
    licencePlate: vehicle.licencePlate ?? '',
    tireSize: vehicle.tireSize ?? '',
  };
}
