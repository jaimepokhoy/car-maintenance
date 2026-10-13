import type { Vehicle } from '../types';
import {
  describeVehicle,
  normalizeLicencePlate,
  normalizeTireSize,
  parseWholeNumber,
  validateVehicleDetails,
  validateVehicleForm,
  vehicleToFormValues,
  type VehicleFormValues,
} from '../vehicle-form';

const valid: VehicleFormValues = {
  nickname: '',
  year: '2019',
  make: ' Honda ',
  model: 'Civic',
  trim: '',
  vin: '',
  powertrain: 'gas',
  odometerKm: '85,000',
  licencePlate: '',
  tireSize: '',
};

describe('parseWholeNumber', () => {
  it('accepts English and French digit grouping', () => {
    expect(parseWholeNumber('85,000')).toBe(85_000);
    expect(parseWholeNumber('85 000')).toBe(85_000);
    expect(parseWholeNumber('85 000')).toBe(85_000);
    expect(parseWholeNumber('85000')).toBe(85_000);
  });

  it('rejects anything that is not a whole number', () => {
    expect(parseWholeNumber('-5')).toBeNull();
    expect(parseWholeNumber('abc')).toBeNull();
    expect(parseWholeNumber('')).toBeNull();
  });
});

describe('validateVehicleForm', () => {
  it('trims fields and defaults the nickname to year, make and model', () => {
    expect(validateVehicleForm(valid, 2026)).toEqual({
      ok: true,
      value: {
        nickname: '2019 Honda Civic',
        year: 2019,
        make: 'Honda',
        model: 'Civic',
        trim: undefined,
        vin: undefined,
        powertrain: 'gas',
        licencePlate: undefined,
        tireSize: undefined,
        odometerKm: 85_000,
      },
    });
  });

  it('keeps a nickname and normalizes a valid VIN', () => {
    const result = validateVehicleForm({ ...valid, nickname: 'Daily', vin: '1m8gdm9axkp042788' }, 2026);
    expect(result).toMatchObject({ ok: true, value: { nickname: 'Daily', vin: '1M8GDM9AXKP042788' } });
  });

  it('reports every problem at once', () => {
    const result = validateVehicleForm(
      { ...valid, year: '1820', make: '', model: ' ', odometerKm: 'lots', vin: 'ABC' },
      2026,
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        year: 'invalidYear',
        make: 'required',
        model: 'required',
        odometerKm: 'invalidOdometer',
        vin: 'invalidVin',
      },
    });
  });

  it('allows next model year but not later', () => {
    expect(validateVehicleForm({ ...valid, year: '2027' }, 2026).ok).toBe(true);
    expect(validateVehicleForm({ ...valid, year: '2028' }, 2026).ok).toBe(false);
  });

  it('requires year and odometer', () => {
    const result = validateVehicleForm({ ...valid, year: '', odometerKm: '' }, 2026);
    expect(result).toEqual({ ok: false, errors: { year: 'required', odometerKm: 'required' } });
  });
});

describe('validateVehicleForm in miles', () => {
  it('converts the odometer to kilometres', () => {
    const result = validateVehicleForm({ ...valid, odometerKm: '10,000' }, 2026, 'mi');
    expect(result).toMatchObject({ ok: true, value: { odometerKm: 16_093 } });
  });
});

describe('optional details', () => {
  it('normalizes trim, plate and tire size', () => {
    const result = validateVehicleForm(
      { ...valid, trim: ' EX ', licencePlate: ' ckmt   123 ', tireSize: '215 / 55 r16 91h' },
      2026,
    );
    expect(result).toMatchObject({
      ok: true,
      value: { trim: 'EX', licencePlate: 'CKMT 123', tireSize: '215/55R16 91H' },
    });
  });

  it('rejects a plate with symbols', () => {
    expect(validateVehicleForm({ ...valid, licencePlate: 'AB#12' }, 2026)).toEqual({
      ok: false,
      errors: { licencePlate: 'invalidPlate' },
    });
  });

  it('normalizes plates and tire sizes on their own', () => {
    expect(normalizeLicencePlate('  abc-123 ')).toBe('ABC-123');
    expect(normalizeTireSize('lt265/70 r17')).toBe('LT265/70R17');
    expect(normalizeTireSize('245/40ZR18')).toBe('245/40ZR18');
  });
});

describe('validateVehicleDetails', () => {
  it('ignores the odometer, for editing an existing car', () => {
    const { odometerKm: _, ...details } = valid;
    const result = validateVehicleDetails(details, 2026);
    expect(result).toMatchObject({ ok: true, value: { make: 'Honda' } });
    expect(result.ok && 'odometerKm' in result.value).toBe(false);
  });
});

describe('vehicleToFormValues', () => {
  const vehicle: Vehicle = {
    id: 'v1',
    nickname: '2019 Honda Civic',
    year: 2019,
    make: 'Honda',
    model: 'Civic',
    trim: 'EX',
    powertrain: 'gas',
    odometerKm: 16_093,
    odometerUpdatedOn: '2026-10-11',
    licencePlate: 'CKMT 123',
  };

  it('prefills the form and round-trips through validation', () => {
    const values = vehicleToFormValues(vehicle);
    expect(values).toMatchObject({ nickname: '', year: '2019', trim: 'EX', vin: '', tireSize: '' });
    expect(validateVehicleForm(values, 2026)).toMatchObject({
      ok: true,
      value: { nickname: '2019 Honda Civic', trim: 'EX', licencePlate: 'CKMT 123', odometerKm: 16_093 },
    });
  });

  it('keeps a custom nickname and shows the odometer in miles', () => {
    expect(vehicleToFormValues({ ...vehicle, nickname: 'Daily' }, 'mi')).toMatchObject({
      nickname: 'Daily',
      odometerKm: '10000',
    });
  });

  it('describes a vehicle with its trim when there is one', () => {
    expect(describeVehicle(vehicle)).toBe('2019 Honda Civic EX');
    expect(describeVehicle({ ...vehicle, trim: undefined })).toBe('2019 Honda Civic');
  });
});
