import { PROVINCES, type Province } from './seasonal-tires';
import type { DistanceUnit } from './types';

export type LanguagePreference = 'system' | 'en' | 'fr';
export type AppearancePreference = 'system' | 'light' | 'dark';

export interface Preferences {
  language: LanguagePreference;
  distanceUnit: DistanceUnit;
  appearance: AppearancePreference;
  /** Used for seasonal tire rules (Quebec's winter tire law). */
  province?: Province;
}

export const DEFAULT_PREFERENCES: Preferences = { language: 'system', distanceUnit: 'km', appearance: 'system' };

/** Reads stored key/value settings, ignoring anything unknown or invalid. */
export function parsePreferences(stored: Record<string, string>): Preferences {
  const preferences: Preferences = { ...DEFAULT_PREFERENCES };
  if (stored.language === 'en' || stored.language === 'fr' || stored.language === 'system') {
    preferences.language = stored.language;
  }
  if (stored.distanceUnit === 'km' || stored.distanceUnit === 'mi') {
    preferences.distanceUnit = stored.distanceUnit;
  }
  if (stored.appearance === 'light' || stored.appearance === 'dark' || stored.appearance === 'system') {
    preferences.appearance = stored.appearance;
  }
  if ((PROVINCES as readonly string[]).includes(stored.province)) {
    preferences.province = stored.province as Province;
  }
  return preferences;
}
