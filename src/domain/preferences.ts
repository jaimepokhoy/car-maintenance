import { PROVINCES, type Province } from './seasonal-tires';
import type { DistanceUnit } from './types';

export type LanguagePreference = 'system' | 'en' | 'fr';

export interface Preferences {
  language: LanguagePreference;
  distanceUnit: DistanceUnit;
  /** Used for seasonal tire rules (Quebec's winter tire law). */
  province?: Province;
}

export const DEFAULT_PREFERENCES: Preferences = { language: 'system', distanceUnit: 'km' };

/** Reads stored key/value settings, ignoring anything unknown or invalid. */
export function parsePreferences(stored: Record<string, string>): Preferences {
  const preferences: Preferences = { ...DEFAULT_PREFERENCES };
  if (stored.language === 'en' || stored.language === 'fr' || stored.language === 'system') {
    preferences.language = stored.language;
  }
  if (stored.distanceUnit === 'km' || stored.distanceUnit === 'mi') {
    preferences.distanceUnit = stored.distanceUnit;
  }
  if ((PROVINCES as readonly string[]).includes(stored.province)) {
    preferences.province = stored.province as Province;
  }
  return preferences;
}
