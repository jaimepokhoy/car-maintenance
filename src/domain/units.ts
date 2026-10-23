import type { CurrencyCode, DistanceUnit, IsoDate } from './types';

const KM_PER_MILE = 1.609344;

export function kmToDisplay(km: number, unit: DistanceUnit): number {
  return unit === 'km' ? km : km / KM_PER_MILE;
}

export function displayToKm(value: number, unit: DistanceUnit): number {
  return unit === 'km' ? value : value * KM_PER_MILE;
}

export function formatDistance(km: number, unit: DistanceUnit, locale: string): string {
  const value = Math.round(kmToDisplay(km, unit));
  return `${new Intl.NumberFormat(locale).format(value)} ${unit}`;
}

export function formatMoney(cents: number, currency: CurrencyCode, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

/**
 * A rough price range like "$80–$150": whole dollars, because the cents in an
 * estimate are false precision. A zero floor reads as "Free–$40".
 */
export function formatMoneyRange(
  minCents: number,
  maxCents: number,
  currency: CurrencyCode,
  locale: string,
  free: string,
): string {
  const whole = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 });
  const format = (cents: number) => (cents === 0 ? free : whole.format(Math.round(cents / 100)));
  return minCents === maxCents ? format(minCents) : `${format(minCents)}–${format(maxCents)}`;
}

/** Formats an ISO calendar date like "Dec 1, 2026" (en-CA) or "1 déc. 2026" (fr-CA). */
export function formatDate(date: IsoDate, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

/** Formats an instant in the device's time zone, like "Oct 22, 2026, 2:05 p.m." (en-CA). */
export function formatDateTime(timestamp: string, locale: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(
    new Date(timestamp),
  );
}
