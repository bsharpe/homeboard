import { addDaysToKey, parseDateKey } from './date';

const SYNODIC_MONTH_DAYS = 29.53058867;
// Known astronomical New Moon: Jan 6, 2000 18:14 UTC
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const DAY_MS = 24 * 60 * 60 * 1000;

export type MajorMoonPhase = 'new' | 'first-quarter' | 'full' | 'last-quarter';

export interface MoonPhaseInfo {
  /** Normalized lunar cycle [0, 1): 0 = New, 0.25 = First Quarter, 0.5 = Full, 0.75 = Last Quarter */
  phase: number;
  /** Fraction illuminated [0, 1] */
  illumination: number;
  /** Human-readable phase name */
  name: string;
  /** Set only on the single closest calendar day to a major phase */
  majorPhase: MajorMoonPhase | null;
}

export function getLunarPhaseValue(date: Date): number {
  const daysSince = (date.getTime() - KNOWN_NEW_MOON_MS) / DAY_MS;
  const cycles = daysSince / SYNODIC_MONTH_DAYS;
  return ((cycles % 1) + 1) % 1;
}

export function getMoonPhaseName(phase: number): string {
  if (phase < 0.03 || phase >= 0.97) return 'New Moon';
  if (phase < 0.22) return 'Waxing Crescent';
  if (phase < 0.28) return 'First Quarter';
  if (phase < 0.47) return 'Waxing Gibbous';
  if (phase < 0.53) return 'Full Moon';
  if (phase < 0.72) return 'Waning Gibbous';
  if (phase < 0.78) return 'Last Quarter';
  return 'Waning Crescent';
}

function circularDistance(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 1 - diff);
}

const MAJOR_TARGETS: Array<{ target: number; kind: MajorMoonPhase }> = [
  { target: 0, kind: 'new' },
  { target: 0.25, kind: 'first-quarter' },
  { target: 0.5, kind: 'full' },
  { target: 0.75, kind: 'last-quarter' },
];

/**
 * Returns lunar phase info for a calendar day (evaluated at 12:00 UTC) and flags
 * `majorPhase` only on the single day closest to each quarter milestone.
 */
export function getMoonPhaseForDateKey(dateKey: string): MoonPhaseInfo {
  const todayPhase = getLunarPhaseValue(parseDateKey(dateKey));
  const prevPhase = getLunarPhaseValue(parseDateKey(addDaysToKey(dateKey, -1)));
  const nextPhase = getLunarPhaseValue(parseDateKey(addDaysToKey(dateKey, 1)));

  let majorPhase: MajorMoonPhase | null = null;
  for (const { target, kind } of MAJOR_TARGETS) {
    const dToday = circularDistance(todayPhase, target);
    const dPrev = circularDistance(prevPhase, target);
    const dNext = circularDistance(nextPhase, target);
    if (dToday < 0.025 && dToday <= dPrev && dToday < dNext) {
      majorPhase = kind;
      break;
    }
  }

  const illumination = (1 - Math.cos(todayPhase * 2 * Math.PI)) / 2;

  return {
    phase: todayPhase,
    illumination,
    name: majorPhase
      ? majorPhase === 'new'
        ? 'New Moon'
        : majorPhase === 'first-quarter'
          ? 'First Quarter'
          : majorPhase === 'full'
            ? 'Full Moon'
            : 'Last Quarter'
      : getMoonPhaseName(todayPhase),
    majorPhase,
  };
}

export function getMoonPhaseForDate(date: Date): Omit<MoonPhaseInfo, 'majorPhase'> {
  const phase = getLunarPhaseValue(date);
  const illumination = (1 - Math.cos(phase * 2 * Math.PI)) / 2;
  return {
    phase,
    illumination,
    name: getMoonPhaseName(phase),
  };
}
