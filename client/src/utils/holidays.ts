import { parseDateKey } from './date';

export type HolidayId =
  | 'new-years'
  | 'valentines'
  | 'st-patricks'
  | 'easter'
  | 'independence'
  | 'halloween'
  | 'thanksgiving'
  | 'christmas';

export interface HolidayInfo {
  id: HolidayId;
  label: string;
}

/** Anonymous Gregorian algorithm (Computus) returning [month (1-12), day (1-31)] for Easter Sunday. */
function getEasterMonthDay(year: number): [number, number] {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return [month, day];
}

/** Nth weekday (0=Sun..6=Sat) of a given month (1-12). */
function getNthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  nth: number
): number {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const offset = (weekday - firstDow + 7) % 7;
  return 1 + offset + (nth - 1) * 7;
}

export function getHolidayForDateKey(dateKey: string): HolidayInfo | null {
  const dt = parseDateKey(dateKey);
  const year = dt.getUTCFullYear();
  const month = dt.getUTCMonth() + 1; // 1-12
  const day = dt.getUTCDate();

  if (month === 1 && day === 1) {
    return { id: 'new-years', label: "New Year's" };
  }
  if (month === 12 && day === 31) {
    return { id: 'new-years', label: "New Year's Eve" };
  }
  if (month === 2 && day === 14) {
    return { id: 'valentines', label: "Valentine's" };
  }
  if (month === 3 && day === 17) {
    return { id: 'st-patricks', label: "St. Patrick's" };
  }
  if (month === 7 && day === 4) {
    return { id: 'independence', label: 'July 4th' };
  }
  if (month === 10 && day === 31) {
    return { id: 'halloween', label: 'Halloween' };
  }
  if (month === 11 && day === getNthWeekdayOfMonth(year, 11, 4, 4)) {
    return { id: 'thanksgiving', label: 'Thanksgiving' };
  }
  if (month === 12 && day === 24) {
    return { id: 'christmas', label: 'Christmas Eve' };
  }
  if (month === 12 && day === 25) {
    return { id: 'christmas', label: 'Christmas' };
  }

  const [easterMonth, easterDay] = getEasterMonthDay(year);
  if (month === easterMonth && day === easterDay) {
    return { id: 'easter', label: 'Easter' };
  }

  return null;
}
