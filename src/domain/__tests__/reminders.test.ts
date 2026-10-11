import { addDays } from '../dates';
import type { DueStatus } from '../due-status';
import {
  DEFAULT_DAILY_KM,
  estimateDailyKm,
  expectedDueDate,
  MAX_REMINDERS,
  planReminders,
} from '../reminders';
import type { ServiceRecord, Vehicle } from '../types';

const today = '2026-10-11';
const vehicle: Vehicle = {
  id: 'v1',
  nickname: 'Civic',
  year: 2019,
  make: 'Honda',
  model: 'Civic',
  powertrain: 'gas',
  odometerKm: 60_000,
  odometerUpdatedOn: '2026-10-01',
};

function record(performedOn: string, odometerKm: number): ServiceRecord {
  return { id: performedOn, vehicleId: 'v1', itemIds: ['oil_change'], performedOn, odometerKm };
}

function status(overrides: Partial<DueStatus>): DueStatus {
  return { itemId: 'oil_change', state: 'ok', ...overrides };
}

describe('addDays', () => {
  it('moves across month and year ends', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('estimateDailyKm', () => {
  it('uses the default with no history', () => {
    expect(estimateDailyKm(vehicle, [])).toBe(DEFAULT_DAILY_KM);
  });

  it('uses the default with under a month of history', () => {
    expect(estimateDailyKm(vehicle, [record('2026-09-20', 59_000)])).toBe(DEFAULT_DAILY_KM);
  });

  it('averages from the oldest service to the current reading', () => {
    // 10,000 km over 200 days.
    const records = [record('2026-06-01', 55_000), record('2026-03-15', 50_000)];
    expect(estimateDailyKm(vehicle, records)).toBeCloseTo(50);
  });
});

describe('expectedDueDate', () => {
  it('takes the sooner of the date limit and the projected km date', () => {
    const byKmFirst = status({ dueOn: '2027-04-01', kmRemaining: 500 });
    expect(expectedDueDate(byKmFirst, 50, today)).toBe('2026-10-21');
    const byDateFirst = status({ dueOn: '2026-10-15', kmRemaining: 5_000 });
    expect(expectedDueDate(byDateFirst, 50, today)).toBe('2026-10-15');
  });

  it('treats an overdue distance as due today', () => {
    expect(expectedDueDate(status({ kmRemaining: -300 }), 50, today)).toBe(today);
  });
});

describe('planReminders', () => {
  it('reminds a week before a future due date', () => {
    const plan = planReminders(
      [{ vehicle, statuses: [status({ dueOn: '2026-12-01' })], records: [] }],
      today,
    );
    expect(plan.find((r) => r.kind === 'maintenance')).toMatchObject({
      itemId: 'oil_change',
      fireOn: '2026-11-24',
    });
  });

  it('nudges in a few days for items already due soon or overdue', () => {
    const plan = planReminders(
      [{ vehicle, statuses: [status({ state: 'overdue', dueOn: '2026-09-01' })], records: [] }],
      today,
    );
    expect(plan.find((r) => r.kind === 'maintenance')?.fireOn).toBe('2026-10-14');
  });

  it('skips items that were never logged', () => {
    const plan = planReminders([{ vehicle, statuses: [status({ state: 'unknown' })], records: [] }], today);
    expect(plan.filter((r) => r.kind === 'maintenance')).toEqual([]);
  });

  it('asks for an odometer update 30 days after the last reading', () => {
    const plan = planReminders([{ vehicle, statuses: [], records: [] }], today);
    expect(plan).toEqual([{ kind: 'odometer', vehicleId: 'v1', fireOn: '2026-10-31' }]);
  });

  it('keeps the earliest reminders under the iOS limit', () => {
    const statuses = Array.from({ length: 80 }, (_, i) =>
      status({ dueOn: addDays('2027-01-01', i) }),
    );
    const plan = planReminders([{ vehicle, statuses, records: [] }], today);
    expect(plan).toHaveLength(MAX_REMINDERS);
    expect(plan[0].fireOn <= plan[MAX_REMINDERS - 1].fireOn).toBe(true);
    expect(plan.some((r) => r.kind === 'odometer')).toBe(true);
  });
});

describe('planReminders: seasonal tires', () => {
  it('needs both a province and a tire set', () => {
    const noTires = planReminders([{ vehicle, statuses: [], records: [] }], today, 'ON');
    expect(noTires.some((r) => r.kind === 'tires')).toBe(false);
    const noProvince = planReminders(
      [{ vehicle: { ...vehicle, tireSet: 'all_season' }, statuses: [], records: [] }],
      today,
    );
    expect(noProvince.some((r) => r.kind === 'tires')).toBe(false);
  });

  it('reminds on the changeover date, or soon if it has passed', () => {
    const before = planReminders(
      [{ vehicle: { ...vehicle, tireSet: 'all_season' }, statuses: [], records: [] }],
      '2026-09-01',
      'QC',
    );
    expect(before.find((r) => r.kind === 'tires')).toMatchObject({
      fireOn: '2026-10-15',
      tires: { action: 'install_winter', legalDeadline: '2026-12-01' },
    });
    const after = planReminders(
      [{ vehicle: { ...vehicle, tireSet: 'all_season' }, statuses: [], records: [] }],
      '2026-11-20',
      'ON',
    );
    expect(after.find((r) => r.kind === 'tires')?.fireOn).toBe('2026-11-23');
  });
});
