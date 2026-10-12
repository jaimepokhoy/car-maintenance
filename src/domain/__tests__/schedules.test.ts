import { defaultSchedule, resolveSchedule } from '../schedules';

describe('defaultSchedule', () => {
  it('gives EVs no oil-related items', () => {
    const items = defaultSchedule('ev').map((i) => i.itemId);
    expect(items).not.toContain('oil_change');
    expect(items).not.toContain('spark_plugs');
    expect(items).toContain('hv_battery_check');
  });

  it('gives hybrids the gas schedule plus a high-voltage battery check', () => {
    const gas = defaultSchedule('gas').map((i) => i.itemId);
    const hybrid = defaultSchedule('hybrid').map((i) => i.itemId);
    expect(hybrid).toEqual([...gas, 'hv_battery_check']);
  });

  it('has no duplicate items and every item has a limit', () => {
    for (const powertrain of ['gas', 'hybrid', 'ev'] as const) {
      const schedule = defaultSchedule(powertrain);
      expect(new Set(schedule.map((i) => i.itemId)).size).toBe(schedule.length);
      for (const interval of schedule) {
        expect(interval.everyKm ?? interval.everyMonths).toBeDefined();
      }
    }
  });

  it('returns copies so callers cannot mutate the defaults', () => {
    defaultSchedule('gas')[0].everyKm = 1;
    expect(defaultSchedule('gas')[0].everyKm).toBe(8_000);
  });
});

describe('resolveSchedule', () => {
  it('replaces a default interval with the owner override', () => {
    const schedule = resolveSchedule('gas', [{ itemId: 'oil_change', everyKm: 12_000, everyMonths: 12 }]);
    expect(schedule.find((i) => i.itemId === 'oil_change')).toEqual({
      itemId: 'oil_change',
      everyKm: 12_000,
      everyMonths: 12,
    });
    expect(schedule).toHaveLength(defaultSchedule('gas').length);
  });
});
