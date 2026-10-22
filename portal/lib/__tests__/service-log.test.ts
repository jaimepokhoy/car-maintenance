import { describe, expect, it } from 'vitest';

import { type ServiceLogContext, parseServiceLog } from '../service-log';

const ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

const context: ServiceLogContext = {
  tenantId: 'tenant-a',
  userId: 'customer-1',
  vehicleId: 'vehicle-1',
  allowedItemIds: ['oil_change', 'tire_rotation', 'brake_inspection'],
  today: '2026-10-22',
};

function form(entries: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    for (const v of Array.isArray(value) ? value : [value]) data.append(key, v);
  }
  return data;
}

const valid = {
  id: ID,
  itemIds: ['oil_change', 'tire_rotation'],
  performedOn: '2026-10-22',
  odometerKm: '58 200',
  cost: '129,99',
  notes: '  Synthetic 0W-20  ',
};

describe('parseServiceLog', () => {
  it('builds a shop record owned by the customer, in km and cents', () => {
    expect(parseServiceLog(form(valid), context)).toEqual({
      ok: true,
      record: {
        id: ID,
        user_id: 'customer-1',
        vehicle_id: 'vehicle-1',
        item_ids: ['oil_change', 'tire_rotation'],
        performed_on: '2026-10-22',
        odometer_km: 58_200,
        cost_cents: 12_999,
        currency: 'CAD',
        notes: 'Synthetic 0W-20',
        created_by_tenant_id: 'tenant-a',
      },
    });
  });

  it('leaves cost, currency and notes empty when not given', () => {
    const result = parseServiceLog(form({ ...valid, cost: '', notes: '' }), context);
    expect(result.ok && result.record).toMatchObject({ cost_cents: null, currency: null, notes: null });
  });

  it('drops a repeated item', () => {
    const result = parseServiceLog(form({ ...valid, itemIds: ['oil_change', 'oil_change'] }), context);
    expect(result.ok && result.record.item_ids).toEqual(['oil_change']);
  });

  it('reports each invalid field', () => {
    const result = parseServiceLog(
      form({ id: 'not-a-uuid', performedOn: '2026-10-23', odometerKm: '58k', cost: 'free', notes: 'x'.repeat(1001) }),
      context,
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        id: 'invalidId',
        itemIds: 'noItems',
        performedOn: 'futureDate',
        odometerKm: 'invalidOdometer',
        cost: 'invalidCost',
        notes: 'notesTooLong',
      },
    });
  });

  it('rejects items outside the vehicle’s schedule', () => {
    const result = parseServiceLog(form({ ...valid, itemIds: ['oil_change', 'hv_battery_check'] }), context);
    expect(result).toEqual({ ok: false, errors: { itemIds: 'unknownItem' } });
  });

  it('requires an odometer reading and a real date', () => {
    expect(parseServiceLog(form({ ...valid, odometerKm: ' ' }), context)).toEqual({
      ok: false,
      errors: { odometerKm: 'required' },
    });
    for (const performedOn of ['', '2026-02-30', '22/10/2026', '1899-12-31']) {
      expect(parseServiceLog(form({ ...valid, performedOn }), context)).toEqual({
        ok: false,
        errors: { performedOn: 'invalidDate' },
      });
    }
  });

  it('caps the odometer like the app', () => {
    expect(parseServiceLog(form({ ...valid, odometerKm: '2000001' }), context)).toEqual({
      ok: false,
      errors: { odometerKm: 'invalidOdometer' },
    });
  });
});
