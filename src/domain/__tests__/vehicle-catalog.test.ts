import { filterOptions, hasExactOption, VEHICLE_MAKES } from '../vehicle-catalog';

describe('VEHICLE_MAKES', () => {
  it('is sorted and has no duplicates', () => {
    const sorted = [...VEHICLE_MAKES].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
    expect(VEHICLE_MAKES).toEqual(sorted);
    expect(new Set(VEHICLE_MAKES).size).toBe(VEHICLE_MAKES.length);
  });
});

describe('filterOptions', () => {
  it('returns everything for an empty query', () => {
    expect(filterOptions(['Honda', 'Kia'], ' ')).toEqual(['Honda', 'Kia']);
  });

  it('ignores case, spaces and dashes', () => {
    expect(filterOptions(['CX-5', 'CX-50', 'Mazda3'], 'cx5')).toEqual(['CX-5', 'CX-50']);
    expect(filterOptions(VEHICLE_MAKES, 'mercedes benz')).toEqual(['Mercedes-Benz']);
    expect(filterOptions(VEHICLE_MAKES, 'land')).toEqual(['Land Rover']);
  });

  it('puts prefix matches before matches inside the name', () => {
    expect(filterOptions(['Grand Cherokee', 'Cherokee', 'Compass'], 'cher')).toEqual([
      'Cherokee',
      'Grand Cherokee',
    ]);
  });

  it('ignores accents', () => {
    expect(filterOptions(['Citroën'], 'citroen')).toEqual(['Citroën']);
  });
});

describe('hasExactOption', () => {
  it('matches regardless of case and punctuation', () => {
    expect(hasExactOption(VEHICLE_MAKES, 'mini')).toBe(true);
    expect(hasExactOption(VEHICLE_MAKES, 'Merc')).toBe(false);
  });
});
