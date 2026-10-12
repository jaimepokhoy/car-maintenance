import { useTranslation } from 'react-i18next';

import { formattingLocale, type Language } from '@/i18n';

/** The locale for formatting numbers, dates and money in the current language. */
export function useLocale(): string {
  const { i18n } = useTranslation();
  return formattingLocale(i18n.language === 'fr' ? 'fr' : ('en' satisfies Language));
}
