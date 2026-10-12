import { isValidVin, normalizeVin } from '../vin';

describe('VIN', () => {
  it('accepts VINs with a correct check digit', () => {
    expect(isValidVin('1M8GDM9AXKP042788')).toBe(true);
    expect(isValidVin('11111111111111111')).toBe(true);
  });

  it('rejects a typo that breaks the check digit', () => {
    expect(isValidVin('1M8GDM9AXKP042789')).toBe(false);
  });

  it('rejects the wrong length and the letters I, O and Q', () => {
    expect(isValidVin('1M8GDM9AXKP04278')).toBe(false);
    expect(isValidVin('1M8GDM9AXKP0427O8')).toBe(false);
  });

  it('normalizes case, spaces and dashes', () => {
    expect(normalizeVin(' 1m8gdm9a-xkp 042788 ')).toBe('1M8GDM9AXKP042788');
  });
});
