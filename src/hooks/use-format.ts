import { useMemo } from 'react';

import {
  formatDate,
  formatDistance,
  formatMoney,
  formatMoneyRange,
  kmToDisplay,
  type CurrencyCode,
  type IsoDate,
} from '@/domain';
import { useLocale } from '@/hooks/use-locale';
import { usePreferences } from '@/hooks/use-preferences';

/** Formatting in the owner's language and distance unit. */
export function useFormat() {
  const locale = useLocale();
  const { distanceUnit } = usePreferences().preferences;

  return useMemo(
    () => ({
      locale,
      distanceUnit,
      distance: (km: number) => formatDistance(km, distanceUnit, locale),
      /** A whole-number reading in the owner's unit, for prefilling inputs. */
      distanceInput: (km: number) => String(Math.round(kmToDisplay(km, distanceUnit))),
      date: (date: IsoDate) => formatDate(date, locale),
      money: (cents: number, currency: CurrencyCode = 'CAD') => formatMoney(cents, currency, locale),
      /** A whole-dollar estimate range; `free` is the word for a zero floor. */
      moneyRange: (minCents: number, maxCents: number, free: string, currency: CurrencyCode = 'CAD') =>
        formatMoneyRange(minCents, maxCents, currency, locale, free),
    }),
    [locale, distanceUnit],
  );
}
