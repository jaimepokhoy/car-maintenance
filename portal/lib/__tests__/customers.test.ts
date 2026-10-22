import { describe, expect, it } from 'vitest';

import {
  type IntervalRow,
  type LinkRow,
  type RecordRow,
  type VehicleRow,
  buildCustomerList,
  canadianToday,
  effectiveOdometerKm,
  recordSource,
  scheduleFor,
  sortHistory,
  vehicleDueStatuses,
  vehicleLabel,
} from '../customers';

const TODAY = '2026-10-22';

function vehicle(overrides: Partial<VehicleRow> & Pick<VehicleRow, 'id' | 'user_id'>): VehicleRow {
  return {
    nickname: 'Car',
    year: 2020,
    make: 'Honda',
    model: 'Civic',
    trim_level: null,
    licence_plate: null,
    powertrain: 'gas',
    odometer_km: 50_000,
    odometer_updated_on: '2026-10-01',
    ...overrides,
  };
}

function record(overrides: Partial<RecordRow> & Pick<RecordRow, 'id' | 'vehicle_id'>): RecordRow {
  return {
    item_ids: ['oil_change'],
    performed_on: '2026-09-01',
    odometer_km: 48_000,
    cost_cents: null,
    currency: null,
    notes: null,
    created_by_tenant_id: null,
    ...overrides,
  };
}

describe('buildCustomerList', () => {
  const links: LinkRow[] = [
    { user_id: 'calm', consented_at: '2026-10-20T12:00:00Z' },
    { user_id: 'urgent', consented_at: '2026-01-01T12:00:00Z' },
    { user_id: 'soon', consented_at: '2026-05-01T12:00:00Z' },
    { user_id: 'empty', consented_at: '2026-10-21T12:00:00Z' },
  ];
  const vehicles = [
    vehicle({ id: 'v-calm', user_id: 'calm' }),
    vehicle({ id: 'v-urgent', user_id: 'urgent', odometer_km: 60_000 }),
    vehicle({ id: 'v-soon', user_id: 'soon', odometer_km: 55_500 }),
    vehicle({ id: 'v-stranger', user_id: 'stranger' }),
  ];
  const records = [
    // 2,000 km and seven weeks since the oil change: not due.
    record({ id: 'r-calm', vehicle_id: 'v-calm' }),
    // 12,000 km since the oil change, 8,000 allowed: overdue.
    record({ id: 'r-urgent', vehicle_id: 'v-urgent' }),
    // 7,500 of 8,000 km used: due soon.
    record({ id: 'r-soon', vehicle_id: 'v-soon' }),
    record({ id: 'r-stranger', vehicle_id: 'v-stranger', odometer_km: 1_000 }),
  ];

  const list = buildCustomerList(links, vehicles, records, [], TODAY);

  it('lists every linked customer, most urgent first, then the newest link', () => {
    expect(list.map((c) => c.userId)).toEqual(['urgent', 'soon', 'empty', 'calm']);
  });

  it('ignores vehicles of users who are not linked to this shop', () => {
    expect(list.flatMap((c) => c.vehicles.map((v) => v.vehicle.id))).not.toContain('v-stranger');
  });

  it('keeps only overdue and due-soon items, and counts them', () => {
    const urgent = list.find((c) => c.userId === 'urgent')!;
    expect(urgent.vehicles[0].due.map((s) => [s.itemId, s.state])).toEqual([['oil_change', 'overdue']]);
    expect(urgent).toMatchObject({ overdue: 1, dueSoon: 0 });

    const soon = list.find((c) => c.userId === 'soon')!;
    expect(soon.vehicles[0].due).toMatchObject([{ itemId: 'oil_change', state: 'due_soon', kmRemaining: 500 }]);
    expect(soon).toMatchObject({ overdue: 0, dueSoon: 1 });

    const calm = list.find((c) => c.userId === 'calm')!;
    expect(calm.vehicles[0].due).toEqual([]);
    expect(list.find((c) => c.userId === 'empty')!.vehicles).toEqual([]);
  });

  it('applies the owner’s schedule overrides', () => {
    const overrides: IntervalRow[] = [{ vehicle_id: 'v-calm', item_id: 'oil_change', every_km: 1_500, every_months: null }];
    const calm = buildCustomerList(links, vehicles, records, overrides, TODAY).find((c) => c.userId === 'calm')!;
    expect(calm.vehicles[0].due).toMatchObject([{ itemId: 'oil_change', state: 'overdue' }]);
  });
});

describe('vehicleDueStatuses', () => {
  it('uses a later service’s odometer when the vehicle row is behind', () => {
    const car = vehicle({ id: 'v', user_id: 'u', odometer_km: 50_000 });
    const rows = [record({ id: 'r', vehicle_id: 'v', odometer_km: 58_000, item_ids: ['tire_rotation'] })];
    expect(effectiveOdometerKm(car, rows)).toBe(58_000);
    const oil = vehicleDueStatuses(car, rows, [], TODAY).find((s) => s.itemId === 'oil_change');
    expect(oil).toEqual({ itemId: 'oil_change', state: 'unknown' });
    const rotation = vehicleDueStatuses(car, rows, [], TODAY).find((s) => s.itemId === 'tire_rotation');
    expect(rotation).toMatchObject({ state: 'ok', dueAtKm: 68_000, kmRemaining: 10_000 });
  });

  it('follows the powertrain schedule', () => {
    const ev = vehicle({ id: 'v', user_id: 'u', powertrain: 'ev' });
    expect(scheduleFor(ev, []).map((i) => i.itemId)).not.toContain('oil_change');
  });
});

describe('history helpers', () => {
  it('sorts newest first, then by odometer', () => {
    const rows = [
      record({ id: 'a', vehicle_id: 'v', performed_on: '2026-01-01', odometer_km: 10 }),
      record({ id: 'b', vehicle_id: 'v', performed_on: '2026-03-01', odometer_km: 20 }),
      record({ id: 'c', vehicle_id: 'v', performed_on: '2026-03-01', odometer_km: 30 }),
    ];
    expect(sortHistory(rows).map((r) => r.id)).toEqual(['c', 'b', 'a']);
  });

  it('says who logged a record', () => {
    expect(recordSource({ created_by_tenant_id: null }, 't1')).toBe('customer');
    expect(recordSource({ created_by_tenant_id: 't1' }, 't1')).toBe('thisShop');
    expect(recordSource({ created_by_tenant_id: 't2' }, 't1')).toBe('otherShop');
  });

  it('labels a vehicle with its trim when set', () => {
    expect(vehicleLabel({ year: 2020, make: 'Honda', model: 'Civic', trim_level: 'EX' })).toBe('2020 Honda Civic EX');
    expect(vehicleLabel({ year: 2020, make: 'Honda', model: 'Civic', trim_level: null })).toBe('2020 Honda Civic');
  });
});

describe('canadianToday', () => {
  it('uses Newfoundland’s date', () => {
    // 23:00 in Toronto is already the next day in St. John's (UTC−2:30 in October).
    expect(canadianToday(new Date('2026-10-23T03:00:00Z'))).toBe('2026-10-23');
    expect(canadianToday(new Date('2026-10-23T01:00:00Z'))).toBe('2026-10-22');
  });
});
