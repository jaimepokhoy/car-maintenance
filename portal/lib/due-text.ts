import { type DueStatus, formatDate, formatDistance } from './domain';
import { type Locale, type Messages, format, localeTag } from './i18n/messages';

/** "Dec 1, 2026 or at 58,000 km": when an item is (or was) due. Empty for items never logged. */
export function dueText(status: DueStatus, locale: Locale, t: Messages['due']): string {
  const tag = localeTag(locale);
  const date = status.dueOn ? formatDate(status.dueOn, tag) : null;
  const distance = status.dueAtKm !== undefined ? formatDistance(status.dueAtKm, 'km', tag) : null;
  if (date && distance) return format(t.onOrAt, { date, distance });
  if (date) return format(t.on, { date });
  if (distance) return format(t.at, { distance });
  return '';
}
