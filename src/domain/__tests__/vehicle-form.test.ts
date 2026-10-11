import { parseWholeNumber, validateVehicleForm, type VehicleFormValues } from '../vehicle-form';

const valid: VehicleFormValues = {
  nickname: '',
  year: '2019',
  make: ' Honda ',
  model: 'Civic',
  vin: '',
  powertrain: 'gas',
  odometerKm: '85,000',
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
        vin: undefined,
        powertrain: 'gas',
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
