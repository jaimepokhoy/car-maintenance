import { csvCell, serviceHistoryCsv, toCsv } from '../export';
import type { ServiceRecord, Vehicle } from '../types';

const vehicle: Vehicle = {
  id: 'v1',
  nickname: 'Daily',
  year: 2019,
  make: 'Honda',
  model: 'Civic',
  powertrain: 'gas',
  odometerKm: 80000,
  odometerUpdatedOn: '2026-10-01',
};

const headers = {
  vehicle: 'Vehicle',
  date: 'Date',
  services: 'Services',
  odometer: 'Odometer (km)',
  cost: 'Cost',
  currency: 'Currency',
  shop: 'Shop',
  notes: 'Notes',
};

function record(overrides: Partial<ServiceRecord>): ServiceRecord {
  return { id: 'r', vehicleId: 'v1', itemIds: ['oil_change'], performedOn: '2026-01-01', odometerKm: 1000, ...overrides };
}

describe('csvCell', () => {
  it('leaves plain text alone and quotes anything that would break a row', () => {
    expect(csvCell('Oil change')).toBe('Oil change');
    expect(csvCell('Front, rear')).toBe('"Front, rear"');
    expect(csvCell('The "good" shop')).toBe('"The ""good"" shop"');
    expect(csvCell('line one\nline two')).toBe('"line one\nline two"');
  });
});

describe('toCsv', () => {
  it('uses CRLF line endings', () => {
    expect(toCsv([['a', 'b'], ['c', 'd']])).toBe('a,b\r\nc,d\r\n');
  });
});

describe('serviceHistoryCsv', () => {
  const options = {
    unit: 'km' as const,
    headers,
    itemLabel: (id: string) => (id === 'oil_change' ? 'Oil change' : 'Tire rotation'),
    shopName: (id: string) => (id === 's1' ? 'Corner Garage' : undefined),
  };

  it('lists services newest first with costs as plain decimals', () => {
    const csv = serviceHistoryCsv(
      [vehicle],
      [
        record({ id: 'old', performedOn: '2025-05-01', costCents: 8999, currency: 'CAD', shopId: 's1' }),
        record({
          id: 'new',
          performedOn: '2026-04-15',
          itemIds: ['oil_change', 'tire_rotation'],
          odometerKm: 75000,
          notes: 'Winter tires off, all good',
        }),
      ],
      options,
    );
    expect(csv.split('\r\n')).toEqual([
      'Vehicle,Date,Services,Odometer (km),Cost,Currency,Shop,Notes',
      'Daily (2019 Honda Civic),2026-04-15,Oil change; Tire rotation,75000,,,,"Winter tires off, all good"',
      'Daily (2019 Honda Civic),2025-05-01,Oil change,1000,89.99,CAD,Corner Garage,',
      '',
    ]);
  });

  it('converts the odometer to miles when the owner uses miles', () => {
    const csv = serviceHistoryCsv([vehicle], [record({ odometerKm: 16093.44 })], { ...options, unit: 'mi' });
    expect(csv.split('\r\n')[1]).toContain(',10000,');
  });

  it('skips records whose vehicle is gone', () => {
    const csv = serviceHistoryCsv([], [record({})], options);
    expect(csv.split('\r\n')).toHaveLength(2);
  });
});
