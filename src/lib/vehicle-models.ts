/**
 * Model names for a make, optionally narrowed to a model year, from NHTSA's
 * free vPIC service. It covers vehicles sold in North America, so Canadian
 * models are included.
 * Results are cached for the session. Callers fall back to typing the model
 * when this fails (no signal, or an unusual make).
 */

const VPIC_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear';

// Without a vehicle type vPIC mixes in motorcycles and trailers; these three cover cars, SUVs, vans and pickups.
const VEHICLE_TYPES = ['car', 'mpv', 'truck'] as const;

const cache = new Map<string, string[]>();

/** Turns a vPIC GetModelsForMakeYear response into sorted, unique model names. */
export function parseModelsResponse(body: unknown): string[] {
  const results = (body as { Results?: { Model_Name?: unknown }[] } | null)?.Results ?? [];
  const names = new Set<string>();
  for (const result of results) {
    const name = typeof result.Model_Name === 'string' ? result.Model_Name.trim() : '';
    // Skip kit-car entries like "'34" that don't start with a letter or digit.
    if (/^[\p{L}\d]/u.test(name)) names.add(name);
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }));
}

/**
 * Every model vPIC knows for the make, or only that year's when `year` is
 * given. The make-only lookup means owners see suggestions as soon as they
 * pick a make, before they enter a year.
 */
export async function fetchModels(
  make: string,
  year: number | null = null,
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  const key = `${make.toLowerCase()}|${year ?? ''}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const yearPart = year === null ? '' : `/modelyear/${year}`;
  const base = `${VPIC_URL}/make/${encodeURIComponent(make)}${yearPart}/vehicletype`;
  const settled = await Promise.allSettled(
    VEHICLE_TYPES.map(async (type) => {
      const response = await fetchImpl(`${base}/${type}?format=json`);
      if (!response.ok) throw new Error(`Model lookup failed: ${response.status}`);
      return response.json();
    }),
  );
  const bodies = settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
  if (bodies.length === 0) throw (settled[0] as PromiseRejectedResult).reason;
  const models = parseModelsResponse({
    Results: bodies.flatMap((body) => (body as { Results?: unknown[] } | null)?.Results ?? []),
  });
  // Only cache a complete answer, so a dropped request is retried next time.
  if (models.length > 0 && bodies.length === VEHICLE_TYPES.length) cache.set(key, models);
  return models;
}
