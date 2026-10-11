import type { IsoDate } from './types';

export type Province =
  | 'AB' | 'BC' | 'MB' | 'NB' | 'NL' | 'NS' | 'NT' | 'NU' | 'ON' | 'PE' | 'QC' | 'SK' | 'YT';

export type TireSet = 'winter' | 'all_season' | 'summer';

export interface TireReminder {
  action: 'install_winter' | 'remove_winter';
  remindOn: IsoDate;
  /** Set where the law requires winter tires by a date (Quebec: December 1). */
  legalDeadline?: IsoDate;
}

// Reminder dates are a rule of thumb (around when daily highs drop below or
// climb above ~7°C across most of Canada), not weather-aware yet.
const INSTALL_MONTH_DAY = '10-15';
const REMOVE_MONTH_DAY = '04-15';
const QC_WINTER_TIRES_FROM = '12-01';
const QC_WINTER_TIRES_UNTIL = '03-15';

/**
 * The next seasonal tire reminder. Owners on winter tires get a removal
 * reminder; everyone else gets an install reminder.
 */
export function nextTireReminder(today: IsoDate, province: Province, currentSet: TireSet): TireReminder {
  const year = Number(today.slice(0, 4));
  const monthDay = today.slice(5);

  if (currentSet === 'winter') {
    if (monthDay > REMOVE_MONTH_DAY && monthDay < INSTALL_MONTH_DAY) {
      // Still on winter tires after the removal date: remind now.
      return { action: 'remove_winter', remindOn: today };
    }
    const removeYear = monthDay >= INSTALL_MONTH_DAY ? year + 1 : year;
    return { action: 'remove_winter', remindOn: `${removeYear}-${REMOVE_MONTH_DAY}` };
  }

  // Past the install date but still in winter: remind now rather than next year.
  const inWinter = monthDay >= INSTALL_MONTH_DAY || monthDay <= QC_WINTER_TIRES_UNTIL;
  const remindOn = inWinter ? today : `${year}-${INSTALL_MONTH_DAY}`;
  const reminder: TireReminder = { action: 'install_winter', remindOn };

  if (province === 'QC') {
    const deadlineYear = monthDay <= QC_WINTER_TIRES_UNTIL ? year - 1 : year;
    reminder.legalDeadline = `${deadlineYear}-${QC_WINTER_TIRES_FROM}`;
  }
  return reminder;
}
