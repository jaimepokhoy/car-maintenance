import { DEFAULT_PREFERENCES, parsePreferences } from '../preferences';

describe('parsePreferences', () => {
  it('defaults to the system language and kilometres', () => {
    expect(parsePreferences({})).toEqual(DEFAULT_PREFERENCES);
  });

  it('reads valid values', () => {
    expect(parsePreferences({ language: 'fr', distanceUnit: 'mi', province: 'QC' })).toEqual({
      language: 'fr',
      distanceUnit: 'mi',
      province: 'QC',
    });
  });

  it('ignores invalid values', () => {
    expect(parsePreferences({ language: 'de', distanceUnit: 'furlongs', province: 'CA' })).toEqual(
      DEFAULT_PREFERENCES,
    );
  });
});
