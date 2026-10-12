const TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/** Uppercases and strips spaces and dashes, as people often type VINs with them. */
export function normalizeVin(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

/**
 * Checks a 17-character VIN, including the North American check digit
 * (position 9), which catches most typos and misreads.
 */
export function isValidVin(vin: string): boolean {
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return false;
  const sum = [...vin].reduce((total, char, index) => {
    const value = /\d/.test(char) ? Number(char) : TRANSLITERATION[char];
    return total + value * WEIGHTS[index];
  }, 0);
  const remainder = sum % 11;
  return vin[8] === (remainder === 10 ? 'X' : String(remainder));
}
