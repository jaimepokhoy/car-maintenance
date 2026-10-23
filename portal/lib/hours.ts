/**
 * Opening hours as stored in `tenants.hours`: one entry per open day,
 * `day` 0-6 with 0 = Sunday, times as 24-hour `HH:MM`. The editor shows one
 * opening per day, Monday first.
 */
export type OpeningHours = { day: number; opens: string; closes: string };

/** Monday first, as Canadian week calendars show it. */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isTime(value: string): boolean {
  return TIME.test(value);
}

/** Form field names for one day's row in the hours editor. */
export function hoursFieldNames(day: number) {
  return { open: `hours-${day}-open`, opens: `hours-${day}-opens`, closes: `hours-${day}-closes` };
}

/** The first opening for each day, keyed by day, from stored hours. */
export function hoursByDay(hours: unknown): Map<number, OpeningHours> {
  const byDay = new Map<number, OpeningHours>();
  if (!Array.isArray(hours)) return byDay;
  for (const entry of hours) {
    if (isOpeningHours(entry) && !byDay.has(entry.day)) byDay.set(entry.day, entry);
  }
  return byDay;
}

export type HoursParse = { ok: true; hours: OpeningHours[] | null } | { ok: false; invalidDays: number[] };

/**
 * Reads the hours editor. A day counts only when its "open" box is ticked,
 * and then needs two valid times with opening before closing. No open days
 * gives null (hours not set).
 */
export function parseHours(form: FormData): HoursParse {
  const hours: OpeningHours[] = [];
  const invalidDays: number[] = [];
  for (let day = 0; day < 7; day++) {
    const names = hoursFieldNames(day);
    if (form.get(names.open) !== 'on') continue;
    const opens = String(form.get(names.opens) ?? '');
    const closes = String(form.get(names.closes) ?? '');
    if (isTime(opens) && isTime(closes) && opens < closes) {
      hours.push({ day, opens, closes });
    } else {
      invalidDays.push(day);
    }
  }
  if (invalidDays.length > 0) return { ok: false, invalidDays };
  return { ok: true, hours: hours.length > 0 ? hours : null };
}

function isOpeningHours(value: unknown): value is OpeningHours {
  if (typeof value !== 'object' || value === null) return false;
  const { day, opens, closes } = value as Record<string, unknown>;
  return (
    typeof day === 'number' &&
    Number.isInteger(day) &&
    day >= 0 &&
    day <= 6 &&
    typeof opens === 'string' &&
    isTime(opens) &&
    typeof closes === 'string' &&
    isTime(closes)
  );
}
