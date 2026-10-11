import type { CurrencyCode, DistanceUnit } from './types';

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
