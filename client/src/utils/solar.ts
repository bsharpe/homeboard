import type { DailyForecastItem } from '../../../shared/types';

export interface SolarInfo {
  sunriseMin: number;
  sunsetMin: number;
  nowMin: number;
  progress: number; // 0 at sunrise, 1 at sunset (clamped 0..1 for arc)
  isDaylight: boolean;
  sunriseLabel: string;
  sunsetLabel: string;
  primaryLabel: string;
  secondaryLabel: string;
  daylightDurationLabel: string;
  daylightDeltaMin: number | null;
}

export interface UvBadgeInfo {
  value: number;
  label: string;
  tone: 'moderate' | 'high' | 'very-high' | 'extreme';
}

export function parseLocalIsoMinutes(localIso: string): number | null {
  // Open-Meteo format: "YYYY-MM-DDTHH:MM"
  const match = /T(\d{2}):(\d{2})/.exec(localIso);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export function getMinutesInTimeZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const rawHour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const hour = rawHour === 24 ? 0 : rawHour;
  return hour * 60 + minute;
}

export function formatMinutesClock(totalMin: number, clockFormat: '12h' | '24h'): string {
  const clamped = ((Math.round(totalMin) % 1440) + 1440) % 1440;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  const mm = String(m).padStart(2, '0');
  if (clockFormat === '24h') {
    return `${String(h).padStart(2, '0')}:${mm}`;
  }
  const suffix = h >= 12 ? 'p' : 'a';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm}${suffix}`;
}

export function formatDurationShort(totalMin: number): string {
  const mins = Math.max(0, Math.round(totalMin));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function getSolarInfo(
  now: Date,
  timeZone: string,
  today: DailyForecastItem | undefined,
  tomorrow: DailyForecastItem | undefined,
  clockFormat: '12h' | '24h'
): SolarInfo | null {
  if (!today?.sunrise || !today?.sunset) return null;
  const sunriseMin = parseLocalIsoMinutes(today.sunrise);
  const sunsetMin = parseLocalIsoMinutes(today.sunset);
  if (sunriseMin === null || sunsetMin === null || sunsetMin <= sunriseMin) return null;

  const nowMin = getMinutesInTimeZone(now, timeZone);
  const daylightMin = sunsetMin - sunriseMin;
  const rawProgress = (nowMin - sunriseMin) / daylightMin;
  const progress = Math.min(1, Math.max(0, rawProgress));
  const isDaylight = nowMin >= sunriseMin && nowMin < sunsetMin;

  const sunriseLabel = formatMinutesClock(sunriseMin, clockFormat);
  const sunsetLabel = formatMinutesClock(sunsetMin, clockFormat);
  const daylightDurationLabel = formatDurationShort(daylightMin);

  let daylightDeltaMin: number | null = null;
  if (tomorrow?.sunrise && tomorrow?.sunset) {
    const tomRise = parseLocalIsoMinutes(tomorrow.sunrise);
    const tomSet = parseLocalIsoMinutes(tomorrow.sunset);
    if (tomRise !== null && tomSet !== null && tomSet > tomRise) {
      daylightDeltaMin = tomSet - tomRise - daylightMin;
    }
  }

  let primaryLabel: string;
  let secondaryLabel: string;

  if (nowMin < sunriseMin) {
    const untilRise = sunriseMin - nowMin;
    primaryLabel = `Sunrise ${sunriseLabel}`;
    secondaryLabel = `in ${formatDurationShort(untilRise)}`;
  } else if (nowMin < sunsetMin) {
    const untilSet = sunsetMin - nowMin;
    primaryLabel = `Sunset ${sunsetLabel}`;
    secondaryLabel = `in ${formatDurationShort(untilSet)}`;
  } else {
    const tomRise = tomorrow?.sunrise ? parseLocalIsoMinutes(tomorrow.sunrise) : sunriseMin;
    const nextRiseMin = tomRise ?? sunriseMin;
    const nextRiseLabel = formatMinutesClock(nextRiseMin, clockFormat);
    const untilRise = 1440 - nowMin + nextRiseMin;
    primaryLabel = `Sunrise ${nextRiseLabel}`;
    secondaryLabel = `in ${formatDurationShort(untilRise)}`;
  }

  return {
    sunriseMin,
    sunsetMin,
    nowMin,
    progress,
    isDaylight,
    sunriseLabel,
    sunsetLabel,
    primaryLabel,
    secondaryLabel,
    daylightDurationLabel,
    daylightDeltaMin,
  };
}

export function getUvBadgeInfo(uvIndex: number, isDay: boolean): UvBadgeInfo | null {
  if (!isDay || uvIndex < 3) return null;
  const rounded = Math.round(uvIndex);
  if (uvIndex >= 11) return { value: rounded, label: 'Extreme', tone: 'extreme' };
  if (uvIndex >= 8) return { value: rounded, label: 'Very High', tone: 'very-high' };
  if (uvIndex >= 6) return { value: rounded, label: 'High', tone: 'high' };
  return { value: rounded, label: 'Moderate', tone: 'moderate' };
}
