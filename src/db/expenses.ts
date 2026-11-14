import type { Expense, ExpenseCategory } from '@/domain';

import type { Db } from './types';

interface ExpenseRow {
  id: string;
  vehicle_id: string;
  category: ExpenseCategory;
  incurred_on: string;
  amount_cents: number;
  currency: Expense['currency'] | null;
  odometer_km: number | null;
  shop_id: string | null;
  notes: string | null;
}

function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    category: row.category,
    incurredOn: row.incurred_on,
    amountCents: row.amount_cents,
    currency: row.currency ?? undefined,
    odometerKm: row.odometer_km ?? undefined,
    shopId: row.shop_id ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export async function listExpenses(db: Db, vehicleId: string): Promise<Expense[]> {
  const rows = await db.getAllAsync<ExpenseRow>(
    `SELECT id, vehicle_id, category, incurred_on, amount_cents, currency, odometer_km, shop_id, notes
     FROM expenses
     WHERE vehicle_id = ? AND deleted_at IS NULL
     ORDER BY incurred_on DESC, created_at DESC`,
    vehicleId,
  );
  return rows.map(toExpense);
}

export async function listAllExpenses(db: Db): Promise<Expense[]> {
  const rows = await db.getAllAsync<ExpenseRow>(
    `SELECT id, vehicle_id, category, incurred_on, amount_cents, currency, odometer_km, shop_id, notes
     FROM expenses
     WHERE deleted_at IS NULL
     ORDER BY incurred_on DESC`,
  );
  return rows.map(toExpense);
}

export async function insertExpense(db: Db, expense: Expense, now: Date): Promise<void> {
  const timestamp = now.toISOString();
  await db.runAsync(
    `INSERT INTO expenses (id, vehicle_id, category, incurred_on, amount_cents, currency, odometer_km,
       shop_id, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    expense.id,
    expense.vehicleId,
    expense.category,
    expense.incurredOn,
    expense.amountCents,
    expense.currency ?? null,
    expense.odometerKm ?? null,
    expense.shopId ?? null,
    expense.notes ?? null,
    timestamp,
    timestamp,
  );
}

/**
 * Saves an expense and, when it noted a higher reading than the one on file,
 * moves the vehicle's odometer forward with it.
 */
export async function logExpense(db: Db, expense: Expense, now: Date): Promise<void> {
  await db.withTransactionAsync(async () => {
    await insertExpense(db, expense, now);
    if (expense.odometerKm === undefined) return;
    await db.runAsync(
      `UPDATE vehicles
       SET odometer_km = ?, odometer_updated_on = MAX(odometer_updated_on, ?), updated_at = ?, dirty = 1
       WHERE id = ? AND odometer_km < ?`,
      expense.odometerKm,
      expense.incurredOn,
      now.toISOString(),
      expense.vehicleId,
      expense.odometerKm,
    );
  });
}

/** Soft delete, so the deletion can sync to other devices. */
export async function deleteExpense(db: Db, id: string, now: Date): Promise<void> {
  const timestamp = now.toISOString();
  await db.runAsync(
    'UPDATE expenses SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?',
    timestamp,
    timestamp,
    id,
  );
}
