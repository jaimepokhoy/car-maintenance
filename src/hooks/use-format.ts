import { useMemo } from 'react';

import { formatDate, formatDistance, formatMoney, kmToDisplay, type CurrencyCode, type IsoDate } from '@/domain';
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
    }),
    [locale, distanceUnit],
  );
}
