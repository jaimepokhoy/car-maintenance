const origin = { latitude: 45.5017, longitude: -73.5673 };

const response = {
  places: [
    {
      id: 'far',
      displayName: { text: 'Garage Far' },
      location: { latitude: 45.55, longitude: -73.6 },
      rating: 4.8,
      userRatingCount: 120,
    },
    {
      id: 'near',
      displayName: { text: 'Garage Near' },
      formattedAddress: '1 Rue Example, Montréal',
      location: { latitude: 45.502, longitude: -73.568 },
      nationalPhoneNumber: '(514) 555-0100',
      currentOpeningHours: { openNow: true },
    },
    { id: 'no-location', displayName: { text: 'Broken' } },
    { displayName: { text: 'No id' }, location: { latitude: 1, longitude: 1 } },
  ],
};

function load(key?: string) {
  jest.resetModules();
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY = key;
  if (key === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../places') as typeof import('../places');
}

describe('parsePlacesResponse', () => {
  it('drops malformed places and sorts nearest first', () => {
    const shops = load('key').parsePlacesResponse(response, origin);
    expect(shops.map((s) => s.placeId)).toEqual(['near', 'far']);
    expect(shops[0]).toMatchObject({ name: 'Garage Near', phone: '(514) 555-0100', openNow: true });
    expect(shops[0].distanceKm).toBeLessThan(0.2);
  });
});

describe('searchNearbyShops', () => {
  it('refuses to search without a key', async () => {
    await expect(load().searchNearbyShops(origin, 'en', jest.fn())).rejects.toThrow('not configured');
  });

  it('sends the key and field mask, then caches by area', async () => {
    const places = load('test-key');
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => response });
    const first = await places.searchNearbyShops(origin, 'fr', fetchImpl, 0);
    const nearby = { latitude: 45.5019, longitude: -73.5671 };
    const second = await places.searchNearbyShops(nearby, 'fr', fetchImpl, 60_000);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers['X-Goog-Api-Key']).toBe('test-key');
    expect(JSON.parse(init.body)).toMatchObject({ includedTypes: ['car_repair'], languageCode: 'fr' });
    expect(second).toBe(first);
  });

  it('searches again once the cache expires', async () => {
    const places = load('test-key');
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => response });
    await places.searchNearbyShops(origin, 'en', fetchImpl, 0);
    await places.searchNearbyShops(origin, 'en', fetchImpl, 31 * 60 * 1000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('reports HTTP errors', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 403 });
    await expect(load('k').searchNearbyShops(origin, 'en', fetchImpl)).rejects.toThrow('403');
  });
});
