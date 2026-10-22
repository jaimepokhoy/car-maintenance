import type { OpeningHours } from '../brand';
import { formatTimeOfDay, openingStatus, shopClock, weekdayName, weekSchedule } from '../opening-hours';

const SUN = 0;
const MON = 1;
const FRI = 5;
const SAT = 6;

/** Monday to Friday 8–6, Saturday 9–1, closed Sunday. */
const weekdays: OpeningHours[] = [1, 2, 3, 4, 5].map((day) => ({ day, opens: '08:00', closes: '18:00' }));
const regular: OpeningHours[] = [...weekdays, { day: SAT, opens: '09:00', closes: '13:00' }];

const at = (day: number, time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return { day, minutes: hours * 60 + minutes };
};

describe('openingStatus', () => {
  it('is unknown without hours', () => {
    expect(openingStatus(null, at(MON, '10:00'))).toEqual({ kind: 'unknown' });
    expect(openingStatus([], at(MON, '10:00'))).toEqual({ kind: 'unknown' });
  });

  it('is open with today’s closing time', () => {
    expect(openingStatus(regular, at(MON, '10:00'))).toEqual({ kind: 'open', closes: '18:00', closesInDays: 0 });
  });

  it('opens on the minute and closes on the minute', () => {
    expect(openingStatus(regular, at(MON, '08:00')).kind).toBe('open');
    expect(openingStatus(regular, at(MON, '18:00'))).toEqual({ kind: 'closed', opens: '08:00', opensInDays: 1 });
  });

  it('opens later today before opening time', () => {
    expect(openingStatus(regular, at(MON, '06:30'))).toEqual({ kind: 'closed', opens: '08:00', opensInDays: 0 });
  });

  it('skips closed days to the next opening', () => {
    expect(openingStatus(regular, at(SAT, '14:00'))).toEqual({ kind: 'closed', opens: '08:00', opensInDays: 2 });
    expect(openingStatus(regular, at(SUN, '12:00'))).toEqual({ kind: 'closed', opens: '08:00', opensInDays: 1 });
  });

  it('wraps from the end of the week to its start', () => {
    const mondayOnly: OpeningHours[] = [{ day: MON, opens: '08:00', closes: '12:00' }];
    expect(openingStatus(mondayOnly, at(MON, '13:00'))).toEqual({ kind: 'closed', opens: '08:00', opensInDays: 7 });
  });

  it('handles a lunch break as two windows', () => {
    const split: OpeningHours[] = [
      { day: MON, opens: '13:00', closes: '17:00' },
      { day: MON, opens: '08:00', closes: '12:00' },
    ];
    expect(openingStatus(split, at(MON, '12:30'))).toEqual({ kind: 'closed', opens: '13:00', opensInDays: 0 });
    expect(openingStatus(split, at(MON, '09:00'))).toEqual({ kind: 'open', closes: '12:00', closesInDays: 0 });
  });

  describe('overnight hours', () => {
    const lateNight: OpeningHours[] = [{ day: FRI, opens: '20:00', closes: '02:00' }];

    it('is open past midnight and closes the next day', () => {
      expect(openingStatus(lateNight, at(FRI, '23:00'))).toEqual({ kind: 'open', closes: '02:00', closesInDays: 1 });
      expect(openingStatus(lateNight, at(SAT, '01:59'))).toEqual({ kind: 'open', closes: '02:00', closesInDays: 0 });
      expect(openingStatus(lateNight, at(SAT, '02:00')).kind).toBe('closed');
    });

    it('runs from Saturday night into Sunday morning across the week boundary', () => {
      const saturdayNight: OpeningHours[] = [{ day: SAT, opens: '22:00', closes: '03:00' }];
      expect(openingStatus(saturdayNight, at(SUN, '01:00'))).toEqual({ kind: 'open', closes: '03:00', closesInDays: 0 });
      expect(openingStatus(saturdayNight, at(SUN, '04:00'))).toEqual({ kind: 'closed', opens: '22:00', opensInDays: 6 });
    });

    it('treats midnight to midnight as open all day', () => {
      const allDay: OpeningHours[] = [{ day: MON, opens: '00:00', closes: '00:00' }];
      expect(openingStatus(allDay, at(MON, '23:30'))).toEqual({ kind: 'open', closes: '00:00', closesInDays: 1 });
    });

    it('joins back-to-back days into one opening', () => {
      const weekend: OpeningHours[] = [
        { day: FRI, opens: '18:00', closes: '00:00' },
        { day: SAT, opens: '00:00', closes: '00:00' },
        { day: SUN, opens: '00:00', closes: '12:00' },
      ];
      expect(openingStatus(weekend, at(FRI, '20:00'))).toEqual({ kind: 'open', closes: '12:00', closesInDays: 2 });
    });

    it('never closes when open around the clock', () => {
      const always: OpeningHours[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, opens: '00:00', closes: '00:00' }));
      expect(openingStatus(always, at(MON, '03:00'))).toEqual({ kind: 'open', closes: null, closesInDays: 0 });
    });
  });
});

describe('shopClock', () => {
  it('reads the wall clock in the shop’s time zone', () => {
    // 2026-07-06 is a Monday; 14:30 UTC is 10:30 in Toronto (EDT).
    expect(shopClock(new Date('2026-07-06T14:30:00Z'), 'America/Toronto')).toEqual(at(MON, '10:30'));
    // The same instant is 07:30 in Vancouver (PDT).
    expect(shopClock(new Date('2026-07-06T14:30:00Z'), 'America/Vancouver')).toEqual(at(MON, '07:30'));
    // 03:00 UTC Monday is still Sunday evening in Toronto.
    expect(shopClock(new Date('2026-07-06T03:00:00Z'), 'America/Toronto')).toEqual(at(SUN, '23:00'));
  });

  it('keeps opening times on the wall clock across daylight saving changes', () => {
    // Toronto springs forward at 02:00 on Sunday 2026-03-08 and falls back on Sunday 2026-11-01.
    const sundays: OpeningHours[] = [{ day: SUN, opens: '08:00', closes: '12:00' }];
    const saturdayNight: OpeningHours[] = [{ day: SAT, opens: '22:00', closes: '03:00' }];

    const lastMinuteOfEst = shopClock(new Date('2026-03-08T06:59:00Z'), 'America/Toronto');
    const firstMinuteOfEdt = shopClock(new Date('2026-03-08T07:00:00Z'), 'America/Toronto');
    expect(lastMinuteOfEst).toEqual(at(SUN, '01:59'));
    expect(firstMinuteOfEdt).toEqual(at(SUN, '03:00'));
    expect(openingStatus(saturdayNight, lastMinuteOfEst)).toEqual({ kind: 'open', closes: '03:00', closesInDays: 0 });
    expect(openingStatus(saturdayNight, firstMinuteOfEdt).kind).toBe('closed');

    // 08:00 local opens at 08:00 local on both sides of each change.
    const springOpening = shopClock(new Date('2026-03-08T12:00:00Z'), 'America/Toronto'); // 08:00 EDT
    const fallOpening = shopClock(new Date('2026-11-01T13:00:00Z'), 'America/Toronto'); // 08:00 EST
    expect(springOpening).toEqual(at(SUN, '08:00'));
    expect(fallOpening).toEqual(at(SUN, '08:00'));
    expect(openingStatus(sundays, springOpening)).toEqual({ kind: 'open', closes: '12:00', closesInDays: 0 });
    expect(openingStatus(sundays, fallOpening)).toEqual({ kind: 'open', closes: '12:00', closesInDays: 0 });
  });

  it('handles the repeated hour when clocks fall back', () => {
    const overnight: OpeningHours[] = [{ day: SAT, opens: '22:00', closes: '02:00' }];
    // 01:30 happens twice on 2026-11-01 in Toronto; the shop is open at both.
    const first = shopClock(new Date('2026-11-01T05:30:00Z'), 'America/Toronto'); // 01:30 EDT
    const second = shopClock(new Date('2026-11-01T06:30:00Z'), 'America/Toronto'); // 01:30 EST
    expect(first).toEqual(at(SUN, '01:30'));
    expect(second).toEqual(at(SUN, '01:30'));
    expect(openingStatus(overnight, second)).toEqual({ kind: 'open', closes: '02:00', closesInDays: 0 });
  });

  it('uses the device clock when no zone is given', () => {
    const now = new Date(2026, 6, 6, 10, 30);
    expect(shopClock(now)).toEqual({ day: now.getDay(), minutes: 630 });
  });
});

describe('weekSchedule', () => {
  it('lists every day Monday first, with closed days empty and windows in order', () => {
    const split: OpeningHours[] = [
      { day: MON, opens: '13:00', closes: '17:00' },
      { day: MON, opens: '08:00', closes: '12:00' },
    ];
    const week = weekSchedule(split);
    expect(week.map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(week[0].windows).toEqual([
      { opens: '08:00', closes: '12:00' },
      { opens: '13:00', closes: '17:00' },
    ]);
    expect(week.slice(1).every((d) => d.windows.length === 0)).toBe(true);
  });

  it('is all closed without hours', () => {
    expect(weekSchedule(null).every((d) => d.windows.length === 0)).toBe(true);
  });
});

describe('formatting', () => {
  it('says times the way each locale does', () => {
    expect(formatTimeOfDay('18:00', 'en-CA')).toMatch(/^6:00\sp\.m\.$/);
    expect(formatTimeOfDay('18:00', 'fr-CA')).toMatch(/^18\sh\s00$/);
  });

  it('names weekdays from Sunday', () => {
    expect(weekdayName(SUN, 'en-CA')).toBe('Sunday');
    expect(weekdayName(MON, 'fr-CA')).toBe('lundi');
  });
});
