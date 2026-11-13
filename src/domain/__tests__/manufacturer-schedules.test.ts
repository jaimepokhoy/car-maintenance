import { manufacturerSchedule } from '../manufacturer-schedules';
import { defaultSchedule, resolveSchedule, resolveVehicleSchedule } from '../schedules';

const toyota = { make: 'Toyota', powertrain: 'gas' as const };

describe('manufacturerSchedule', () => {
  it('returns the maker schedule for a covered make', () => {
    const schedule = manufacturerSchedule(toyota);
    expect(schedule?.label).toBe('Toyota');
    expect(schedule?.source).toContain('normal duty');
    expect(schedule?.powertrains.gas?.find((i) => i.itemId === 'oil_change')).toEqual({
      itemId: 'oil_change',
      everyKm: 16_000,
      everyMonths: 12,
    });
  });

  it('matches makes ignoring case and spacing', () => {
    expect(manufacturerSchedule({ make: '  toyota ', powertrain: 'gas' })?.label).toBe('Toyota');
  });

  it('returns nothing for a make with no schedule on file', () => {
    expect(manufacturerSchedule({ make: 'Rivian', powertrain: 'gas' })).toBeUndefined();
  });

  it('never offers a powertrain the maker does not sell', () => {
    expect(manufacturerSchedule({ make: 'Tesla', powertrain: 'gas' })).toBeUndefined();
    expect(manufacturerSchedule({ make: 'Tesla', powertrain: 'ev' })?.powertrains.ev).toBeDefined();
  });

  it('adds the high-voltage check to a hybrid schedule', () => {
    const items = manufacturerSchedule({ make: 'Toyota', powertrain: 'hybrid' })!.powertrains.hybrid!;
    expect(items.some((i) => i.itemId === 'hv_battery_check')).toBe(true);
    expect(items.find((i) => i.itemId === 'hv_battery_check')?.everyMonths).toBe(12);
  });

  it('gives an EV no gas-only items', () => {
    const items = manufacturerSchedule({ make: 'Hyundai', powertrain: 'ev' })!.powertrains.ev!;
    expect(items.map((i) => i.itemId)).not.toContain('oil_change');
    expect(items.map((i) => i.itemId)).not.toContain('spark_plugs');
    expect(items.map((i) => i.itemId)).toContain('hv_battery_check');
  });

  it('has unique items with at least one limit for every schedule it returns', () => {
    for (const make of ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'Hyundai', 'Nissan', 'Mazda', 'Subaru', 'Volkswagen', 'BMW', 'Mercedes-Benz', 'Ram', 'Mitsubishi', 'Volvo', 'Tesla']) {
      for (const powertrain of ['gas', 'hybrid', 'ev'] as const) {
        const items = manufacturerSchedule({ make, powertrain })?.powertrains[powertrain];
        if (!items) continue;
        expect(new Set(items.map((i) => i.itemId)).size).toBe(items.length);
        for (const interval of items) expect(interval.everyKm ?? interval.everyMonths).toBeDefined();
      }
    }
  });
});

describe('resolveVehicleSchedule', () => {
  it('prefers the manufacturer schedule over the general defaults', () => {
    const schedule = resolveVehicleSchedule(toyota);
    expect(schedule.find((i) => i.itemId === 'oil_change')?.everyKm).toBe(16_000);
  });

  it('falls back to the general defaults for an uncovered make', () => {
    const schedule = resolveVehicleSchedule({ make: 'Rivian', powertrain: 'gas' });
    expect(schedule).toEqual(defaultSchedule('gas'));
  });

  it('applies owner overrides on top of the manufacturer schedule', () => {
    const schedule = resolveVehicleSchedule(toyota, [{ itemId: 'oil_change', everyKm: 8_000, everyMonths: 6 }]);
    expect(schedule.find((i) => i.itemId === 'oil_change')).toEqual({
      itemId: 'oil_change',
      everyKm: 8_000,
      everyMonths: 6,
    });
    expect(schedule).toHaveLength(manufacturerSchedule(toyota)!.powertrains.gas!.length);
  });

  it('still resolves the generic schedule when callers have no vehicle', () => {
    expect(resolveSchedule('ev').map((i) => i.itemId)).toContain('hv_battery_check');
  });
});
