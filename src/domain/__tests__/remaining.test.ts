import { describeDuration } from '../dates';
import { compareDueStatuses, intervalProgress, remainingLimits, type DueStatus } from '../due-status';
import type { ServiceRecord } from '../types';

const last: ServiceRecord = { id: 's', vehicleId: 'v', itemIds: ['oil_change'], performedOn: '2026-03-12', odometerKm: 50_000 };

describe('intervalProgress', () => {
  it('is undefined for an item never logged', () => {
    expect(intervalProgress({ itemId: 'oil_change', state: 'unknown' })).toBeUndefined();
  });

  it('measures the most pressing limit', () => {
    const status: DueStatus = {
      itemId: 'oil_change',
      state: 'due_soon',
      lastService: last,
      dueAtKm: 58_000,
      kmRemaining: 800,
      dueOn: '2026-09-12',
      daysRemaining: 120,
    };
    expect(intervalProgress(status)).toBeCloseTo(0.9);
  });

  it('caps at 1 when overdue', () => {
    expect(
      intervalProgress({ itemId: 'oil_change', state: 'overdue', lastService: last, dueAtKm: 58_000, kmRemaining: -612 }),
    ).toBe(1);
  });
});

describe('remainingLimits', () => {
  const base: DueStatus = { itemId: 'oil_change', state: 'ok' };

  it('is empty for an item never logged', () => {
    expect(remainingLimits({ ...base, state: 'unknown' })).toEqual([]);
  });

  it('puts the limit closest to its threshold first', () => {
    expect(remainingLimits({ ...base, kmRemaining: 900, daysRemaining: 29 })).toEqual([
      { kind: 'km', value: 900 },
      { kind: 'days', value: 29 },
    ]);
    expect(remainingLimits({ ...base, kmRemaining: 5_000, daysRemaining: 10 })).toEqual([
      { kind: 'days', value: 10 },
      { kind: 'km', value: 5_000 },
    ]);
  });

  it('puts the overdue limit first', () => {
    expect(remainingLimits({ ...base, state: 'overdue', kmRemaining: 3_000, daysRemaining: -4 })[0]).toEqual({
      kind: 'days',
      value: -4,
    });
  });
});

describe('compareDueStatuses', () => {
  it('orders by state, then by how soon', () => {
    const soon: DueStatus = { itemId: 'oil_change', state: 'due_soon', daysRemaining: 3 };
    const later: DueStatus = { itemId: 'tire_rotation', state: 'due_soon', kmRemaining: 900 };
    const late: DueStatus = { itemId: 'brake_fluid', state: 'overdue', daysRemaining: -1 };
    expect([later, soon, late].sort(compareDueStatuses).map((s) => s.itemId)).toEqual([
      'brake_fluid',
      'oil_change',
      'tire_rotation',
    ]);
  });
});

describe('describeDuration', () => {
  it('speaks in days, then weeks, then months', () => {
    expect(describeDuration(3)).toEqual({ unit: 'day', count: 3 });
    expect(describeDuration(-13)).toEqual({ unit: 'day', count: 13 });
    expect(describeDuration(35)).toEqual({ unit: 'week', count: 5 });
    expect(describeDuration(200)).toEqual({ unit: 'month', count: 7 });
  });
});
