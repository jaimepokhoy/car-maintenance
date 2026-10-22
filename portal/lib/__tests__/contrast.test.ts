import { describe, expect, it } from 'vitest';

import { DARK_ON_ACCENT, LIGHT_ON_ACCENT, contrastRatio, isHexColour, pickOnAccent } from '../contrast';

describe('contrastRatio', () => {
  it('spans 1 to 21', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
  });

  it('is symmetric and case-insensitive', () => {
    expect(contrastRatio('#3dd9eb', '#061317')).toBeCloseTo(contrastRatio('#061317', '#3DD9EB'));
  });

  it('matches the WCAG reference value for #767676 on white', () => {
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
  });

  it('rejects anything but #RRGGBB', () => {
    expect(() => contrastRatio('#FFF', '#000000')).toThrow();
    expect(() => contrastRatio('red', '#000000')).toThrow();
  });
});

describe('pickOnAccent', () => {
  it('uses dark ink on the default cyan accent', () => {
    expect(pickOnAccent('#3DD9EB')).toBe(DARK_ON_ACCENT);
  });

  it('uses white on dark accents', () => {
    expect(pickOnAccent('#0B3D91')).toBe(LIGHT_ON_ACCENT);
  });

  it('returns null for a mid-tone accent neither colour passes on', () => {
    expect(pickOnAccent('#7A7A7A')).toBeNull();
  });
});

describe('isHexColour', () => {
  it('accepts six-digit hex only', () => {
    expect(isHexColour('#a1B2c3')).toBe(true);
    expect(isHexColour('a1b2c3')).toBe(false);
    expect(isHexColour('#abc')).toBe(false);
  });
});
