/**
 * Opening hours of a shop: whether it is open right now and when that
 * changes, from the `hours` a shop sets in its portal.
 *
 * Everything works on the shop's wall clock (day of week and minutes since
 * midnight), never on elapsed milliseconds, so a daylight saving change can't
 * shift an opening time by an hour.
 */

import type { OpeningHours } from './brand';

/** A moment on the shop's wall clock; `day` 0 is Sunday. */
export type ShopClock = { day: number; minutes: number };

export type OpeningStatus =
  /** No hours are known. */
  | { kind: 'unknown' }
  /** Open now. `closes` is null when it never closes (open around the clock). */
  | { kind: 'open'; closes: string | null; closesInDays: number }
  /** Closed now; opens at `opens`, `opensInDays` from today (0 is later today). */
  | { kind: 'closed'; opens: string; opensInDays: number };

/** One day of the week with its opening windows, earliest first. Empty means closed. */
export type DaySchedule = { day: number; windows: { opens: string; closes: string }[] };

const DAY = 24 * 60;
const WEEK = 7 * DAY;
/** Shops list their week Monday first. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * The wall clock at `now`, in `timeZone` (an IANA name like
 * `America/Toronto`) or in the device's zone when none is given.
 */
export function shopClock(now: Date, timeZone?: string): ShopClock {
  if (!timeZone) return { day: now.getDay(), minutes: now.getHours() * 60 + now.getMinutes() };
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return { day: WEEKDAYS.indexOf(part('weekday')), minutes: Number(part('hour')) * 60 + Number(part('minute')) };
}

/**
 * Whether the shop is open at `clock` and when that next changes. A window
 * whose closing time is at or before its opening time runs past midnight
 * (22:00–02:00); `00:00`–`00:00` is open all day. Back-to-back windows count
 * as one, so a shop open around the clock on Friday and Saturday closes
 * Saturday night, not at midnight.
 */
export function openingStatus(hours: readonly OpeningHours[] | null, clock: ShopClock): OpeningStatus {
  if (!hours || hours.length === 0) return { kind: 'unknown' };
  const windows = toWeekWindows(hours);
  const today = clock.day * DAY + clock.minutes;

  // Saturday's late window runs into Sunday morning, past the end of the week.
  for (const now of [today, today + WEEK]) {
    const current = windows.find((w) => now >= w.start && now < w.end);
    if (!current) continue;
    let end = current.end;
    // Follow windows that start exactly when the previous one ends.
    for (let next = startingAt(windows, end); next && end - now < WEEK; next = startingAt(windows, end)) {
      end += next.end - next.start;
    }
    if (end - now >= WEEK) return { kind: 'open', closes: null, closesInDays: 0 };
    return { kind: 'open', closes: toTime(end % DAY), closesInDays: daysBetween(now, end) };
  }

  const next = Math.min(...windows.map((w) => (w.start > today ? w.start : w.start + WEEK)));
  return { kind: 'closed', opens: toTime(next % DAY), opensInDays: daysBetween(today, next) };
}

/** The full week, Monday first, for the hours table. */
export function weekSchedule(hours: readonly OpeningHours[] | null): DaySchedule[] {
  return WEEK_ORDER.map((day) => ({
    day,
    windows: (hours ?? [])
      .filter((h) => h.day === day)
      .map(({ opens, closes }) => ({ opens, closes }))
      .sort((a, b) => a.opens.localeCompare(b.opens)),
  }));
}

/** A `HH:MM` time the way the locale says it: "6:00 p.m." in en-CA, "18 h" in fr-CA. */
export function formatTimeOfDay(time: string, locale: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2024, 0, 1, hours, minutes)),
  );
}

/** The weekday's full name in the locale; `day` 0 is Sunday. */
export function weekdayName(day: number, locale: string): string {
  // 2024-01-07 was a Sunday.
  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2024, 0, 7 + day)),
  );
}

type Window = { start: number; end: number };

function toWeekWindows(hours: readonly OpeningHours[]): Window[] {
  return hours.map(({ day, opens, closes }) => {
    const start = day * DAY + toMinutes(opens);
    let length = toMinutes(closes) - toMinutes(opens);
    if (length <= 0) length += DAY;
    return { start, end: start + length };
  });
}

/** The window that opens at week-minute `at`, which may be in the following week. */
function startingAt(windows: readonly Window[], at: number): Window | undefined {
  return windows.find((w) => w.start === at % WEEK);
}

/** Calendar days between two week-minutes. */
function daysBetween(from: number, to: number): number {
  return Math.floor(to / DAY) - Math.floor(from / DAY);
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function toTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
