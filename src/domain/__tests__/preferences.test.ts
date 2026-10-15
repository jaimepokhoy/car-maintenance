import { DEFAULT_PREFERENCES, parsePreferences } from '../preferences';

describe('parsePreferences', () => {
  it('defaults to the system language, kilometres and the system appearance', () => {
    expect(parsePreferences({})).toEqual(DEFAULT_PREFERENCES);
  });

  it('reads valid values', () => {
    expect(
      parsePreferences({ language: 'fr', distanceUnit: 'mi', appearance: 'dark', province: 'QC' }),
    ).toEqual({
      language: 'fr',
      distanceUnit: 'mi',
      appearance: 'dark',
      province: 'QC',
    });
  });

  it('ignores invalid values', () => {
    expect(
      parsePreferences({ language: 'de', distanceUnit: 'furlongs', appearance: 'sepia', province: 'CA' }),
    ).toEqual(DEFAULT_PREFERENCES);
  });
});
