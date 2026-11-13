import { evaluateVehicle } from '../evaluation';
import type { DueState, DueStatus } from '../due-status';
import type { Expense, MaintenanceItemId, ServiceRecord } from '../types';

function status(itemId: MaintenanceItemId, state: DueState): DueStatus {
  return { itemId, state };
}

function record(odometerKm: number, costCents?: number): ServiceRecord {
  return {
    id: `r${odometerKm}`,
    vehicleId: 'v1',
    itemIds: ['oil_change'],
    performedOn: '2026-01-01',
    odometerKm,
    costCents,
  };
}

function expense(odometerKm: number | undefined, amountCents: number): Expense {
  return {
    id: `e${amountCents}`,
    vehicleId: 'v1',
    category: 'fuel',
    incurredOn: '2026-02-01',
    amountCents,
    odometerKm,
  };
}

const today = '2026-10-11';

describe('evaluateVehicle', () => {
  it('has no score until at least one item is logged', () => {
    const evaluation = evaluateVehicle(
      { odometerKm: 50_000 },
      [status('oil_change', 'unknown'), status('brake_fluid', 'unknown')],
      [],
      [],
      today,
    );
    expect(evaluation.score).toBeNull();
    expect(evaluation.grade).toBeUndefined();
    expect(evaluation.hasHistory).toBe(false);
    expect(evaluation.breakdown).toMatchObject({ unknown: 2, tracked: 0, total: 2 });
  });

  it('scores a fully tracked, up-to-date schedule at 100', () => {
    const evaluation = evaluateVehicle(
      { odometerKm: 50_000 },
      [status('oil_change', 'ok'), status('brake_fluid', 'ok')],
      [],
      [],
      today,
    );
    expect(evaluation.score).toBe(100);
    expect(evaluation.grade).toBe('excellent');
  });

  it('weights adherence and coverage equally', () => {
    // Two tracked and up to date of four items: 50 adherence + 25 coverage.
    const evaluation = evaluateVehicle(
      { odometerKm: 50_000 },
      [
        status('oil_change', 'ok'),
        status('tire_rotation', 'ok'),
        status('brake_fluid', 'unknown'),
        status('coolant', 'unknown'),
      ],
      [],
      [],
      today,
    );
    expect(evaluation.score).toBe(75);
    expect(evaluation.grade).toBe('good');
  });

  it('counts an item due soon as half kept up', () => {
    // (1 + 0.5) / 2 adherence = 75%, full coverage: 37.5 + 50 = 87.5 → 88.
    const evaluation = evaluateVehicle(
      { odometerKm: 50_000 },
      [status('oil_change', 'ok'), status('brake_fluid', 'due_soon')],
      [],
      [],
      today,
    );
    expect(evaluation.score).toBe(88);
    expect(evaluation.grade).toBe('excellent');
  });

  it('drops an overdue item to zero adherence and names it as the next item', () => {
    const evaluation = evaluateVehicle(
      { odometerKm: 50_000 },
      [status('oil_change', 'overdue'), status('brake_fluid', 'ok')],
      [],
      [],
      today,
    );
    expect(evaluation.score).toBe(75);
    expect(evaluation.nextItemId).toBe('oil_change');
    expect(evaluation.breakdown.overdue).toBe(1);
  });

  it('reports spend and distance facts from logged readings', () => {
    const evaluation = evaluateVehicle(
      { odometerKm: 75_000 },
      [status('oil_change', 'ok')],
      [record(65_000, 12_000)],
      [expense(70_000, 8_000)],
      today,
    );
    expect(evaluation.spend.totalCents).toBe(20_000);
    expect(evaluation.servicesLogged).toBe(1);
    expect(evaluation.expensesLogged).toBe(1);
    expect(evaluation.documentedKm).toBe(10_000);
    expect(evaluation.costPer1000KmCents).toBe(2_000);
  });

  it('leaves the per-distance figure out when the reading moved too little to mean anything', () => {
    const evaluation = evaluateVehicle(
      { odometerKm: 75_040 },
      [status('oil_change', 'ok')],
      [record(75_000, 12_000)],
      [],
      today,
    );
    expect(evaluation.costPer1000KmCents).toBeUndefined();
  });
});
