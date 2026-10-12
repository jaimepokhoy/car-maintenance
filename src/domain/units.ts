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

/** Formats an ISO calendar date like "Dec 1, 2026" (en-CA) or "1 déc. 2026" (fr-CA). */
export function formatDate(date: IsoDate, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}
