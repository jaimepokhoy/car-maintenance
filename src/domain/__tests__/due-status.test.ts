import { computeDueStatus, computeVehicleDueStatuses, lastServiceFor } from '../due-status';
import type { MaintenanceInterval, ServiceRecord } from '../types';

const oil: MaintenanceInterval = { itemId: 'oil_change', everyKm: 8_000, everyMonths: 6 };

function service(overrides: Partial<ServiceRecord> = {}): ServiceRecord {
  return {
    id: 's1',
    vehicleId: 'v1',
    itemIds: ['oil_change'],
    performedOn: '2026-06-01',
    odometerKm: 50_000,
    ...overrides,
  };
}

describe('lastServiceFor', () => {
  it('picks the most recent record that includes the item', () => {
    const records = [
      service({ id: 'old', performedOn: '2026-01-01' }),
      service({ id: 'new', performedOn: '2026-06-01' }),
      service({ id: 'other', performedOn: '2026-09-01', itemIds: ['tire_rotation'] }),
    ];
    expect(lastServiceFor('oil_change', records)?.id).toBe('new');
  });

  it('breaks same-day ties by odometer', () => {
    const records = [service({ id: 'a', odometerKm: 100 }), service({ id: 'b', odometerKm: 200 })];
    expect(lastServiceFor('oil_change', records)?.id).toBe('b');
  });
});

describe('computeDueStatus', () => {
  it('is unknown when the item has never been logged', () => {
    expect(computeDueStatus(oil, { odometerKm: 50_000 }, [], '2026-10-11').state).toBe('unknown');
  });

  it('is ok when both limits are comfortably away', () => {
    const status = computeDueStatus(oil, { odometerKm: 52_000 }, [service()], '2026-07-01');
    expect(status).toMatchObject({
      state: 'ok',
      dueOn: '2026-12-01',
      dueAtKm: 58_000,
      daysRemaining: 153,
      kmRemaining: 6_000,
    });
  });

  it('is due soon when the date is within 30 days', () => {
    const status = computeDueStatus(oil, { odometerKm: 52_000 }, [service()], '2026-11-05');
    expect(status.state).toBe('due_soon');
  });

  it('is due soon when the distance is within 1,000 km', () => {
    const status = computeDueStatus(oil, { odometerKm: 57_500 }, [service()], '2026-07-01');
    expect(status.state).toBe('due_soon');
  });

  it('is overdue when the distance limit is passed even if the date is not', () => {
    const status = computeDueStatus(oil, { odometerKm: 58_100 }, [service()], '2026-07-01');
    expect(status).toMatchObject({ state: 'overdue', kmRemaining: -100 });
  });

  it('is overdue when the date limit is passed even if the distance is not', () => {
    const status = computeDueStatus(oil, { odometerKm: 51_000 }, [service()], '2026-12-02');
    expect(status).toMatchObject({ state: 'overdue', daysRemaining: -1 });
  });

  it('handles date-only intervals', () => {
    const fluid: MaintenanceInterval = { itemId: 'brake_fluid', everyMonths: 24 };
    const records = [service({ itemIds: ['brake_fluid'] })];
    const status = computeDueStatus(fluid, { odometerKm: 999_999 }, records, '2027-01-01');
    expect(status).toMatchObject({ state: 'ok', dueOn: '2028-06-01' });
    expect(status.kmRemaining).toBeUndefined();
  });

  it('handles distance-only intervals', () => {
    const plugs: MaintenanceInterval = { itemId: 'spark_plugs', everyKm: 100_000 };
    const records = [service({ itemIds: ['spark_plugs'] })];
    const status = computeDueStatus(plugs, { odometerKm: 60_000 }, records, '2040-01-01');
    expect(status).toMatchObject({ state: 'ok', kmRemaining: 90_000 });
    expect(status.daysRemaining).toBeUndefined();
  });
});

describe('computeVehicleDueStatuses', () => {
  const schedule: MaintenanceInterval[] = [
    oil,
    { itemId: 'tire_rotation', everyKm: 10_000, everyMonths: 12 },
    { itemId: 'wiper_blades', everyMonths: 12 },
    { itemId: 'cabin_air_filter', everyKm: 24_000, everyMonths: 12 },
  ];

  it('sorts overdue, then due soon, then unknown, then ok', () => {
    const records = [
      service({ id: 'oil', itemIds: ['oil_change'], performedOn: '2026-01-01' }),
      service({ id: 'tires', itemIds: ['tire_rotation'], performedOn: '2025-11-01' }),
      service({ id: 'cabin', itemIds: ['cabin_air_filter'], performedOn: '2026-09-01' }),
    ];
    const statuses = computeVehicleDueStatuses(
      schedule,
      { id: 'v1', odometerKm: 52_000 },
      records,
      '2026-10-11',
    );
    expect(statuses.map((s) => [s.itemId, s.state])).toEqual([
      ['oil_change', 'overdue'],
      ['tire_rotation', 'due_soon'],
      ['wiper_blades', 'unknown'],
      ['cabin_air_filter', 'ok'],
    ]);
  });

  it('ignores records from other vehicles', () => {
    const records = [service({ vehicleId: 'someone-else' })];
    const [status] = computeVehicleDueStatuses([oil], { id: 'v1', odometerKm: 0 }, records, '2026-10-11');
    expect(status.state).toBe('unknown');
  });
});
