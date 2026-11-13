import { validateExpenseForm } from '../expense-form';
import type { ExpenseFormValues } from '../expense-form';

const today = '2026-10-11';

const values: ExpenseFormValues = {
  category: 'fuel',
  incurredOn: today,
  amount: '62.40',
  odometerKm: '',
  notes: '',
};

describe('validateExpenseForm', () => {
  it('accepts an amount without an odometer', () => {
    const result = validateExpenseForm(values, today);
    expect(result).toEqual({
      ok: true,
      value: { category: 'fuel', incurredOn: today, amountCents: 6240, odometerKm: undefined, notes: undefined },
    });
  });

  it('converts a mileage reading to kilometres', () => {
    const result = validateExpenseForm({ ...values, odometerKm: '10000' }, today, 'mi');
    expect(result.ok && result.value.odometerKm).toBe(16_093);
  });

  it('rejects a future date', () => {
    const result = validateExpenseForm({ ...values, incurredOn: '2026-10-12' }, today);
    expect(result).toEqual({ ok: false, errors: { incurredOn: 'futureDate' } });
  });

  it('requires an amount', () => {
    const result = validateExpenseForm({ ...values, amount: '  ' }, today);
    expect(result).toEqual({ ok: false, errors: { amount: 'required' } });
  });

  it('rejects an amount that is not money', () => {
    const result = validateExpenseForm({ ...values, amount: 'sixty' }, today);
    expect(result).toEqual({ ok: false, errors: { amount: 'invalidAmount' } });
  });

  it('rejects an odometer reading that is not a whole number', () => {
    const result = validateExpenseForm({ ...values, odometerKm: '12k' }, today);
    expect(result).toEqual({ ok: false, errors: { odometerKm: 'invalidOdometer' } });
  });
});
