import type { BoardTheme, WeatherData } from '../../../shared/types';
import { getDateKeyInTimeZone } from './date';
import { getMinutesInTimeZone, parseLocalIsoMinutes } from './solar';

export type SkyPhase = 'dawn' | 'morning' | 'midday' | 'golden' | 'dusk' | 'night';
export type WeatherMood = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';
export type Season = 'winter' | 'spring' | 'summer' | 'autumn';
export type ResolvedTheme = 'dark' | 'light';

export function getSkyPhase(
  now: Date,
  timeZone: string,
  sunriseIso?: string,
  sunsetIso?: string
): SkyPhase {
  const nowMin = getMinutesInTimeZone(now, timeZone);
  const sunriseMin = sunriseIso ? parseLocalIsoMinutes(sunriseIso) : null;
  const sunsetMin = sunsetIso ? parseLocalIsoMinutes(sunsetIso) : null;

  if (sunriseMin !== null && sunsetMin !== null && sunsetMin > sunriseMin) {
    if (nowMin < sunriseMin - 45) return 'night';
    if (nowMin < sunriseMin + 45) return 'dawn';
    if (nowMin < sunriseMin + 210 && nowMin < sunsetMin - 180) return 'morning';
    if (nowMin < sunsetMin - 90) return 'midday';
    if (nowMin < sunsetMin + 20) return 'golden';
    if (nowMin < sunsetMin + 65) return 'dusk';
    return 'night';
  }

  // Fallback when sunrise/sunset aren't loaded yet
  if (nowMin < 360) return 'night';
  if (nowMin < 450) return 'dawn';
  if (nowMin < 660) return 'morning';
  if (nowMin < 960) return 'midday';
  if (nowMin < 1110) return 'golden';
  if (nowMin < 1200) return 'dusk';
  return 'night';
}

export function getWeatherMood(weatherCode?: number): WeatherMood {
  if (weatherCode === undefined || weatherCode === null) return 'clear';
  if (weatherCode >= 95) return 'storm';
  if ((weatherCode >= 71 && weatherCode <= 77) || weatherCode === 85 || weatherCode === 86) {
    return 'snow';
  }
  if (
    (weatherCode >= 51 && weatherCode <= 67) ||
    (weatherCode >= 80 && weatherCode <= 82)
  ) {
    return 'rain';
  }
  if (weatherCode === 45 || weatherCode === 48) return 'fog';
  if (weatherCode === 2 || weatherCode === 3) return 'cloudy';
  return 'clear';
}

export function getSeason(now: Date, timeZone: string, latitude = 35): Season {
  const dateKey = getDateKeyInTimeZone(now, timeZone);
  const month = Number(dateKey.slice(5, 7)); // 1..12
  const southern = latitude < 0;

  let northSeason: Season;
  if (month === 12 || month <= 2) northSeason = 'winter';
  else if (month <= 5) northSeason = 'spring';
  else if (month <= 8) northSeason = 'summer';
  else northSeason = 'autumn';

  if (!southern) return northSeason;
  const flip: Record<Season, Season> = {
    winter: 'summer',
    spring: 'autumn',
    summer: 'winter',
    autumn: 'spring',
  };
  return flip[northSeason];
}

export function resolveBoardTheme(
  theme: BoardTheme,
  weather: WeatherData | null,
  now: Date,
  timeZone: string
): ResolvedTheme {
  if (theme === 'light') return 'light';
  if (theme === 'dark') return 'dark';
  // 'auto': light during daylight, dark at night
  if (weather) {
    const today = weather.daily[0];
    const phase = getSkyPhase(now, timeZone, today?.sunrise, today?.sunset);
    return phase === 'night' || phase === 'dusk' ? 'dark' : 'light';
  }
  const nowMin = getMinutesInTimeZone(now, timeZone);
  return nowMin >= 420 && nowMin < 1140 ? 'light' : 'dark';
}
