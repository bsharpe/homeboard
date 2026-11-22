import { getDateKeyInTimeZone, parseDateKey } from './date';

export type HolidayId =
  | 'new-years'
  | 'valentines'
  | 'st-patricks'
  | 'easter'
  | 'independence'
  | 'halloween'
  | 'thanksgiving'
  | 'christmas'
  | 'spring-equinox'
  | 'summer-solstice'
  | 'autumn-equinox'
  | 'winter-solstice';

export interface HolidayInfo {
  id: HolidayId;
  label: string;
}

export interface HolidayLookupOptions {
  timezone?: string;
  latitude?: number;
}

const DEG_TO_RAD = Math.PI / 180;
const DELTA_T_MS = 69_000; // Approximate TT - UTC offset (~69s for modern years)

/** Periodic terms from Jean Meeus, Astronomical Algorithms (Table 27.C). */
const MEEUS_TERMS: ReadonlyArray<readonly [number, number, number]> = [
  [485, 324.96, 1934.136],
  [203, 337.23, 32964.467],
  [199, 342.08, 20.186],
  [182, 27.85, 445267.112],
  [156, 73.14, 45036.886],
  [136, 171.52, 22518.443],
  [77, 222.54, 65928.934],
  [74, 296.72, 3034.906],
  [70, 243.58, 9037.513],
  [58, 119.81, 33718.147],
  [52, 297.17, 150.678],
  [50, 21.02, 2281.226],
  [45, 247.54, 29929.562],
  [44, 325.15, 31555.956],
  [29, 60.93, 4443.417],
  [18, 155.12, 67555.328],
  [17, 288.79, 4562.452],
  [16, 198.04, 62894.029],
  [14, 199.76, 31436.921],
  [12, 95.39, 14577.848],
  [12, 287.11, 31931.756],
  [12, 320.81, 34777.259],
  [9, 227.73, 1222.114],
  [8, 15.45, 16859.074],
];

function computeSeasonalEventDate(jde0: number): Date {
  const t = (jde0 - 2451545.0) / 36525;
  const w = (35999.373 * t - 2.47) * DEG_TO_RAD;
  const deltaLambda = 1 + 0.0334 * Math.cos(w) + 0.0007 * Math.cos(2 * w);
  let s = 0;
  for (const [a, b, c] of MEEUS_TERMS) {
    s += a * Math.cos((b + c * t) * DEG_TO_RAD);
  }
  const jde = jde0 + (0.00001 * s) / deltaLambda;
  const utcMs = (jde - 2440587.5) * 86_400_000 - DELTA_T_MS;
  return new Date(utcMs);
}

export interface EquinoxSolsticeInstants {
  marchEquinox: Date;
  juneSolstice: Date;
  septemberEquinox: Date;
  decemberSolstice: Date;
}

const seasonalInstantsCache = new Map<number, EquinoxSolsticeInstants>();

/**
 * Computes UTC instants for the four astronomical solstices & equinoxes of a given year
 * using Jean Meeus's Astronomical Algorithms (Chapter 27, accurate to ~1 minute).
 */
export function getEquinoxSolsticeInstants(year: number): EquinoxSolsticeInstants {
  const cached = seasonalInstantsCache.get(year);
  if (cached) return cached;

  const y = (year - 2000) / 1000;
  const y2 = y * y;
  const y3 = y2 * y;
  const y4 = y3 * y;

  const instants: EquinoxSolsticeInstants = {
    marchEquinox: computeSeasonalEventDate(
      2451623.80984 + 365242.37404 * y + 0.05169 * y2 - 0.00411 * y3 - 0.00057 * y4
    ),
    juneSolstice: computeSeasonalEventDate(
      2451716.56767 + 365241.62603 * y + 0.00325 * y2 + 0.00888 * y3 - 0.0003 * y4
    ),
    septemberEquinox: computeSeasonalEventDate(
      2451810.21715 + 365242.01767 * y - 0.11575 * y2 + 0.00337 * y3 + 0.00078 * y4
    ),
    decemberSolstice: computeSeasonalEventDate(
      2451900.05952 + 365242.74049 * y - 0.06223 * y2 - 0.00823 * y3 + 0.00032 * y4
    ),
  };

  seasonalInstantsCache.set(year, instants);
  return instants;
}

function getSeasonalHolidayForDateKey(
  dateKey: string,
  year: number,
  timezone: string,
  latitude: number
): HolidayInfo | null {
  const southern = latitude < 0;
  const instants = getEquinoxSolsticeInstants(year);

  if (dateKey === getDateKeyInTimeZone(instants.marchEquinox, timezone)) {
    return southern
      ? { id: 'autumn-equinox', label: 'Autumn Equinox' }
      : { id: 'spring-equinox', label: 'Spring Equinox' };
  }
  if (dateKey === getDateKeyInTimeZone(instants.juneSolstice, timezone)) {
    return southern
      ? { id: 'winter-solstice', label: 'Winter Solstice' }
      : { id: 'summer-solstice', label: 'Summer Solstice' };
  }
  if (dateKey === getDateKeyInTimeZone(instants.septemberEquinox, timezone)) {
    return southern
      ? { id: 'spring-equinox', label: 'Spring Equinox' }
      : { id: 'autumn-equinox', label: 'Autumn Equinox' };
  }
  if (dateKey === getDateKeyInTimeZone(instants.decemberSolstice, timezone)) {
    return southern
      ? { id: 'summer-solstice', label: 'Summer Solstice' }
      : { id: 'winter-solstice', label: 'Winter Solstice' };
  }

  return null;
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

export function getHolidayForDateKey(
  dateKey: string,
  options?: HolidayLookupOptions
): HolidayInfo | null {
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

  if (month === 3 || month === 6 || month === 9 || month === 12) {
    const seasonal = getSeasonalHolidayForDateKey(
      dateKey,
      year,
      options?.timezone ?? 'UTC',
      options?.latitude ?? 35
    );
    if (seasonal) return seasonal;
  }

  return null;
}
