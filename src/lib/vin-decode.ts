import type { Powertrain } from '@/domain';

/** What NHTSA's free vPIC service could tell us about a VIN. Any field may be missing. */
export interface DecodedVin {
  year?: string;
  make?: string;
  model?: string;
  powertrain?: Powertrain;
}

type VpicResult = Record<string, string | null | undefined>;

const VPIC_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues';

// vPIC returns makes in capitals ("HONDA"); show them the way owners write them.
function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_, separator: string, letter: string) => separator + letter.toUpperCase());
}

function clean(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed !== 'Not Applicable' ? trimmed : undefined;
}

function powertrainFrom(result: VpicResult): Powertrain | undefined {
  const electrification = clean(result.ElectrificationLevel)?.toUpperCase() ?? '';
  const fuel = [clean(result.FuelTypePrimary), clean(result.FuelTypeSecondary)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (electrification.startsWith('BEV')) return 'ev';
  if (electrification.includes('HEV')) return 'hybrid'; // HEV, PHEV, mild and strong hybrids
  if (fuel === 'electric') return 'ev';
  if (fuel.includes('electric')) return 'hybrid';
  if (fuel) return 'gas'; // gasoline, diesel, flex fuel: all follow the combustion schedule
  return undefined;
}

/** Turns a vPIC DecodeVinValues response into the fields the vehicle form uses. */
export function parseVpicResponse(body: unknown): DecodedVin | null {
  const result = (body as { Results?: VpicResult[] } | null)?.Results?.[0];
  if (!result) return null;

  const make = clean(result.Make);
  const decoded: DecodedVin = {
    year: clean(result.ModelYear),
    make: make ? titleCase(make) : undefined,
    model: clean(result.Model),
    powertrain: powertrainFrom(result),
  };
  return decoded.year || decoded.make || decoded.model ? decoded : null;
}

/**
 * Looks a VIN up with NHTSA. vPIC covers vehicles sold in North America, so
 * Canadian cars decode too. Returns null when nothing useful came back.
 */
export async function decodeVin(vin: string, fetchImpl: typeof fetch = fetch): Promise<DecodedVin | null> {
  const response = await fetchImpl(`${VPIC_URL}/${encodeURIComponent(vin)}?format=json`);
  if (!response.ok) throw new Error(`VIN lookup failed: ${response.status}`);
  return parseVpicResponse(await response.json());
}
