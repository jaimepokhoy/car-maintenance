import type { IsoDate } from './types';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parse(date: IsoDate): Date {
  const match = ISO_DATE.exec(date);
  if (!match) throw new Error(`Invalid ISO date: ${date}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function format(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

/** Adds calendar months, clamping to the end of shorter months (Jan 31 + 1 = Feb 28/29). */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const start = parse(date);
  const targetMonth = start.getUTCMonth() + months;
  const lastDayOfTarget = new Date(Date.UTC(start.getUTCFullYear(), targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(start.getUTCDate(), lastDayOfTarget);
  return format(new Date(Date.UTC(start.getUTCFullYear(), targetMonth, day)));
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000);
}

export function toIsoDate(date: Date): IsoDate {
  return format(new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())));
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return format(new Date(parse(date).getTime() + days * 86_400_000));
}

export interface Duration {
  unit: 'day' | 'week' | 'month';
  count: number;
}

/**
 * Rounds a number of days to the unit people say out loud: days under two
 * weeks, weeks under two months, months beyond. The sign is dropped; callers
 * already know whether it is remaining or overdue.
 */
export function describeDuration(days: number): Duration {
  const abs = Math.abs(days);
  if (abs < 14) return { unit: 'day', count: abs };
  if (abs < 60) return { unit: 'week', count: Math.round(abs / 7) };
  return { unit: 'month', count: Math.round(abs / 30) };
}
