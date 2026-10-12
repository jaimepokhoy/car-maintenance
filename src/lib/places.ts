import { distanceKm, type LatLng } from '@/domain/geo';

/**
 * Nearby repair shops from the Google Places API (New). The key comes from
 * EXPO_PUBLIC_GOOGLE_PLACES_KEY; without it the shop finder explains it isn't
 * set up yet. Restrict the key to this app's bundle IDs in Google Cloud.
 */
export const PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY;

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchNearby';
const FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.nationalPhoneNumber',
  'places.currentOpeningHours.openNow',
  'places.googleMapsUri',
].join(',');
const SEARCH_RADIUS_M = 10_000;
const CACHE_MS = 30 * 60 * 1000;

export interface NearbyShop {
  placeId: string;
  name: string;
  address?: string;
  location: LatLng;
  distanceKm: number;
  rating?: number;
  ratingCount?: number;
  phone?: string;
  openNow?: boolean;
  mapsUrl?: string;
}

interface PlacesResponse {
  places?: {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    rating?: number;
    userRatingCount?: number;
    nationalPhoneNumber?: string;
    currentOpeningHours?: { openNow?: boolean };
    googleMapsUri?: string;
  }[];
}

/** Keeps well-formed results, adds distance from the searcher, nearest first. */
export function parsePlacesResponse(response: PlacesResponse, origin: LatLng): NearbyShop[] {
  const shops: NearbyShop[] = [];
  for (const place of response.places ?? []) {
    const name = place.displayName?.text;
    const { latitude, longitude } = place.location ?? {};
    if (!place.id || !name || latitude === undefined || longitude === undefined) continue;
    const location = { latitude, longitude };
    shops.push({
      placeId: place.id,
      name,
      address: place.formattedAddress,
      location,
      distanceKm: distanceKm(origin, location),
      rating: place.rating,
      ratingCount: place.userRatingCount,
      phone: place.nationalPhoneNumber,
      openNow: place.currentOpeningHours?.openNow,
      mapsUrl: place.googleMapsUri,
    });
  }
  return shops.sort((a, b) => a.distanceKm - b.distanceKm);
}

/** Rounds to about 1 km so small moves reuse the last search. */
export function cacheKey(origin: LatLng, language: string): string {
  return `${origin.latitude.toFixed(2)},${origin.longitude.toFixed(2)},${language}`;
}

const cache = new Map<string, { at: number; shops: NearbyShop[] }>();

/**
 * Each search is billed, so results are cached for 30 minutes per area to
 * keep a free app's API costs near zero.
 */
export async function searchNearbyShops(
  origin: LatLng,
  language: string,
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
): Promise<NearbyShop[]> {
  if (!PLACES_KEY) throw new Error('Places API key is not configured');
  const key = cacheKey(origin, language);
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MS) return hit.shops;

  const response = await fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': PLACES_KEY,
      'X-Goog-FieldMask': FIELDS,
    },
    body: JSON.stringify({
      includedTypes: ['car_repair'],
      maxResultCount: 20,
      languageCode: language,
      regionCode: 'CA',
      locationRestriction: { circle: { center: origin, radius: SEARCH_RADIUS_M } },
    }),
  });
  if (!response.ok) throw new Error(`Places search failed: ${response.status}`);
  const shops = parsePlacesResponse((await response.json()) as PlacesResponse, origin);
  cache.set(key, { at: now, shops });
  return shops;
}
