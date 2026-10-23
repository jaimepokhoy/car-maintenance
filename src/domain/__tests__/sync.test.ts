import {
  advanceCursor,
  compareTimestamps,
  isRowRejection,
  pullSince,
  retryDelayMs,
  shouldApplyRemote,
  SYNC_KEYS,
  SYNC_TABLES,
  toIsoTimestamp,
} from '../sync';

describe('sync rules', () => {
  it('syncs parents before the rows that reference them', () => {
    expect(SYNC_TABLES.indexOf('vehicles')).toBeLessThan(SYNC_TABLES.indexOf('maintenance_intervals'));
    expect(SYNC_TABLES.indexOf('vehicles')).toBeLessThan(SYNC_TABLES.indexOf('service_records'));
    expect(SYNC_TABLES.indexOf('shops')).toBeLessThan(SYNC_TABLES.indexOf('service_records'));
    expect(SYNC_KEYS.maintenance_intervals).toEqual(['vehicle_id', 'item_id']);
  });

  it('normalizes Postgres timestamps and compares them by instant', () => {
    expect(toIsoTimestamp('2026-10-22T14:05:09.123456+00:00')).toBe('2026-10-22T14:05:09.123Z');
    expect(toIsoTimestamp('2026-10-22T10:05:09-04:00')).toBe('2026-10-22T14:05:09.000Z');
    expect(compareTimestamps('2026-10-22T10:05:09-04:00', '2026-10-22T14:05:09.000Z')).toBe(0);
  });

  it('applies a remote row only when it is new or written later (last write wins)', () => {
    expect(shouldApplyRemote(null, '2026-10-22T14:00:00Z')).toBe(true);
    expect(shouldApplyRemote({ updated_at: '2026-10-22T13:00:00.000Z' }, '2026-10-22T14:00:00+00:00')).toBe(true);
    // Older remote loses, and the same write coming back is skipped.
    expect(shouldApplyRemote({ updated_at: '2026-10-22T15:00:00.000Z' }, '2026-10-22T14:00:00+00:00')).toBe(false);
    expect(shouldApplyRemote({ updated_at: '2026-10-22T14:00:00.000Z' }, '2026-10-22T14:00:00+00:00')).toBe(false);
  });

  it('pulls everything without a cursor and from a minute before it otherwise', () => {
    expect(pullSince(null)).toBeNull();
    expect(pullSince('2026-10-22T14:00:00.000Z')).toBe('2026-10-22T13:59:00.000Z');
  });

  it('moves the cursor forward to the newest row and never back', () => {
    expect(advanceCursor(null, [])).toBeNull();
    expect(
      advanceCursor(null, [{ updated_at: '2026-10-22T14:00:00+00:00' }, { updated_at: '2026-10-22T15:00:00+00:00' }]),
    ).toBe('2026-10-22T15:00:00.000Z');
    expect(advanceCursor('2026-10-22T16:00:00.000Z', [{ updated_at: '2026-10-22T15:00:00+00:00' }])).toBe(
      '2026-10-22T16:00:00.000Z',
    );
  });

  it('backs off exponentially up to 15 minutes', () => {
    expect([1, 2, 3, 4].map(retryDelayMs)).toEqual([15_000, 30_000, 60_000, 120_000]);
    expect(retryDelayMs(20)).toBe(15 * 60_000);
  });

  it('tells refused rows from failures worth retrying', () => {
    expect(isRowRejection('23514')).toBe(true);
    expect(isRowRejection('22P02')).toBe(true);
    expect(isRowRejection('42501')).toBe(true);
    expect(isRowRejection(undefined)).toBe(false);
    expect(isRowRejection('')).toBe(false);
    expect(isRowRejection('PGRST301')).toBe(false);
  });
});
