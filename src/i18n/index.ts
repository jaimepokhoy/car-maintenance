import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import fr from './locales/fr.json';

export const SUPPORTED_LANGUAGES = ['en', 'fr'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const resources = { en: { translation: en }, fr: { translation: fr } } as const;

export function detectLanguage(): Language {
  const code = getLocales()[0]?.languageCode;
  return code === 'fr' ? 'fr' : 'en';
}

/** Locale used for number, date and currency formatting, e.g. `fr-CA`. */
export function formattingLocale(language: Language): string {
  return `${language}-CA`;
}

const i18n = createInstance();

i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
