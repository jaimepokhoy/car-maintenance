import { parseMoneyToCents, validateServiceForm, type ServiceFormValues } from '../service-form';

const valid: ServiceFormValues = {
  itemIds: ['oil_change'],
  performedOn: '2026-10-11',
  odometerKm: '85 400',
  cost: '',
  notes: '  ',
};

describe('parseMoneyToCents', () => {
  it('handles English and French formats', () => {
    expect(parseMoneyToCents('89.99')).toBe(8999);
    expect(parseMoneyToCents('89,99')).toBe(8999);
    expect(parseMoneyToCents('$1,234.50')).toBe(123_450);
    expect(parseMoneyToCents('1 234,50')).toBe(123_450);
    expect(parseMoneyToCents('120')).toBe(12_000);
  });

  it('rejects malformed amounts', () => {
    expect(parseMoneyToCents('12.345')).toBeNull();
    expect(parseMoneyToCents('-5')).toBeNull();
    expect(parseMoneyToCents('abc')).toBeNull();
  });
});

describe('validateServiceForm', () => {
  it('parses a minimal service and drops blank optional fields', () => {
    expect(validateServiceForm(valid, '2026-10-11')).toEqual({
      ok: true,
      value: {
        itemIds: ['oil_change'],
        performedOn: '2026-10-11',
        odometerKm: 85_400,
        costCents: undefined,
        notes: undefined,
      },
    });
  });

  it('keeps cost and notes and removes duplicate items', () => {
    const result = validateServiceForm(
      { ...valid, itemIds: ['oil_change', 'tire_rotation', 'oil_change'], cost: '129,99', notes: ' Jiffy ' },
      '2026-10-11',
    );
    expect(result).toMatchObject({
      ok: true,
      value: { itemIds: ['oil_change', 'tire_rotation'], costCents: 12_999, notes: 'Jiffy' },
    });
  });

  it('reports every problem at once', () => {
    const result = validateServiceForm(
      { ...valid, itemIds: [], performedOn: '2026-10-12', odometerKm: '', cost: 'lots' },
      '2026-10-11',
    );
    expect(result).toEqual({
      ok: false,
      errors: { itemIds: 'noItems', performedOn: 'futureDate', odometerKm: 'required', cost: 'invalidCost' },
    });
  });
});

describe('validateServiceForm in miles', () => {
  it('converts the odometer to kilometres', () => {
    const result = validateServiceForm({ ...valid, odometerKm: '1000' }, '2026-10-11', 'mi');
    expect(result).toMatchObject({ ok: true, value: { odometerKm: 1_609 } });
  });
});
