import { createMemoryDb } from '@/test-utils/memory-db';

import { deleteExpense, insertExpense, listAllExpenses, listExpenses, logExpense } from '../expenses';
import { migrate } from '../migrations';
import type { Db } from '../types';
import { deleteVehicle, getVehicle, insertVehicle } from '../vehicles';

const now = new Date('2026-11-12T12:00:00Z');
const civic = {
  nickname: 'Daily driver',
  year: 2019,
  make: 'Honda',
  model: 'Civic',
  powertrain: 'gas' as const,
  odometerKm: 85_000,
};

let db: Db;

beforeEach(async () => {
  db = createMemoryDb();
  await migrate(db);
  await insertVehicle(db, 'v1', civic, now, '2026-11-01');
});

describe('expenses', () => {
  it('inserts and lists expenses newest first', async () => {
    await insertExpense(
      db,
      { id: 'e1', vehicleId: 'v1', category: 'insurance', incurredOn: '2026-01-15', amountCents: 120_000 },
      now,
    );
    await insertExpense(
      db,
      { id: 'e2', vehicleId: 'v1', category: 'fuel', incurredOn: '2026-03-01', amountCents: 6_000, odometerKm: 86_000 },
      now,
    );
    const expenses = await listExpenses(db, 'v1');
    expect(expenses.map((e) => e.id)).toEqual(['e2', 'e1']);
    expect(expenses[0]).toMatchObject({ category: 'fuel', amountCents: 6_000, odometerKm: 86_000 });
  });

  it('moves the odometer forward only when the expense notes a higher reading', async () => {
    await logExpense(
      db,
      { id: 'e1', vehicleId: 'v1', category: 'fuel', incurredOn: '2026-11-02', amountCents: 6_000, odometerKm: 84_000 },
      now,
    );
    expect((await getVehicle(db, 'v1'))?.odometerKm).toBe(85_000);

    await logExpense(
      db,
      { id: 'e2', vehicleId: 'v1', category: 'fuel', incurredOn: '2026-11-03', amountCents: 6_000, odometerKm: 87_500 },
      now,
    );
    expect((await getVehicle(db, 'v1'))?.odometerKm).toBe(87_500);
    expect((await getVehicle(db, 'v1'))?.odometerUpdatedOn).toBe('2026-11-03');

    // A backdated receipt can raise the reading but must not make the reading look older.
    await logExpense(
      db,
      { id: 'e3', vehicleId: 'v1', category: 'fuel', incurredOn: '2026-10-20', amountCents: 5_000, odometerKm: 88_000 },
      now,
    );
    expect((await getVehicle(db, 'v1'))?.odometerUpdatedOn).toBe('2026-11-03');
  });

  it('soft deletes an expense out of lists', async () => {
    await insertExpense(
      db,
      { id: 'e1', vehicleId: 'v1', category: 'parking', incurredOn: '2026-02-01', amountCents: 1_200 },
      now,
    );
    await deleteExpense(db, 'e1', now);
    expect(await listExpenses(db, 'v1')).toEqual([]);
    expect(await listAllExpenses(db)).toEqual([]);
  });

  it('soft deletes a vehicle expenses along with the vehicle', async () => {
    await insertExpense(
      db,
      { id: 'e1', vehicleId: 'v1', category: 'tolls', incurredOn: '2026-02-01', amountCents: 800 },
      now,
    );
    await deleteVehicle(db, 'v1', now);
    expect(await listAllExpenses(db)).toEqual([]);
    expect(await getVehicle(db, 'v1')).toBeNull();
  });
});
