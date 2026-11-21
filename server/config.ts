import fs from 'node:fs/promises';
import path from 'node:path';
import type { AppConfig, CalendarFeedConfig } from '../shared/types.js';

export const DEFAULT_CONFIG: AppConfig = {
  weather: {
    provider: 'open-meteo',
    name: 'Santa Fe, NM',
    latitude: 35.687,
    longitude: -105.9378,
    timezone: 'America/Denver',
    unit: 'fahrenheit',
  },
  display: {
    title: 'Homeboard',
    gridMode: 'rolling-4w',
    weekStartsOn: 0,
    clockFormat: '12h',
    showSeconds: false,
    showHourlyWeather: true,
    agendaDays: 10,
    demoMode: true,
    nightDimEnabled: true,
    nightDimStartHour: 22,
    nightDimEndHour: 6,
    nightDimOpacity: 0.3,
    burnInShift: true,
    theme: 'dark',
    seasonalAccents: true,
    ambientWeather: true,
    calendarWeather: true,
  },
  refresh: {
    calendarMinutes: 10,
    weatherMinutes: 15,
  },
  calendars: [],
};

const DATA_DIR = process.env.HOMEBOARD_DATA_DIR
  ? path.resolve(process.env.HOMEBOARD_DATA_DIR)
  : path.resolve(process.cwd(), 'data');

const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

export function getConfigPath(): string {
  return CONFIG_PATH;
}

function clamp(val: number, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || Number.isNaN(val)) return fallback;
  return Math.min(max, Math.max(min, val));
}

function sanitizeCalendars(raw: unknown): CalendarFeedConfig[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item, index) => ({
      id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `cal-${index + 1}`,
      name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : `Calendar ${index + 1}`,
      url: typeof item.url === 'string' ? item.url.trim() : '',
      color: typeof item.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(item.color) ? item.color : '#38bdf8',
      enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
    }))
    .filter((cal) => cal.url.length > 0);
}

export function mergeWithDefaults(partial: Partial<AppConfig> | null | undefined): AppConfig {
  const weather = {
    ...DEFAULT_CONFIG.weather,
    ...(partial?.weather ?? {}),
  };
  weather.provider = weather.provider === 'tempest' ? 'tempest' : 'open-meteo';
  weather.latitude = clamp(weather.latitude, -90, 90, DEFAULT_CONFIG.weather.latitude);
  weather.longitude = clamp(weather.longitude, -180, 180, DEFAULT_CONFIG.weather.longitude);
  weather.unit = weather.unit === 'celsius' ? 'celsius' : 'fahrenheit';
  weather.tempestToken =
    typeof weather.tempestToken === 'string' && weather.tempestToken.trim().length > 0
      ? weather.tempestToken.trim()
      : undefined;
  weather.tempestStationId =
    typeof weather.tempestStationId === 'number' &&
    Number.isFinite(weather.tempestStationId) &&
    weather.tempestStationId > 0
      ? Math.round(weather.tempestStationId)
      : undefined;

  const display = {
    ...DEFAULT_CONFIG.display,
    ...(partial?.display ?? {}),
  };
  display.gridMode = display.gridMode === 'month' ? 'month' : 'rolling-4w';
  display.weekStartsOn = display.weekStartsOn === 1 ? 1 : 0;
  display.clockFormat = display.clockFormat === '24h' ? '24h' : '12h';
  display.agendaDays = clamp(display.agendaDays, 3, 30, DEFAULT_CONFIG.display.agendaDays);
  display.nightDimStartHour = clamp(display.nightDimStartHour, 0, 23, DEFAULT_CONFIG.display.nightDimStartHour);
  display.nightDimEndHour = clamp(display.nightDimEndHour, 0, 23, DEFAULT_CONFIG.display.nightDimEndHour);
  display.nightDimOpacity = clamp(display.nightDimOpacity, 0.15, 1, DEFAULT_CONFIG.display.nightDimOpacity);
  display.theme =
    display.theme === 'light' || display.theme === 'auto' ? display.theme : 'dark';
  display.seasonalAccents =
    typeof display.seasonalAccents === 'boolean'
      ? display.seasonalAccents
      : DEFAULT_CONFIG.display.seasonalAccents;
  display.ambientWeather =
    typeof display.ambientWeather === 'boolean'
      ? display.ambientWeather
      : DEFAULT_CONFIG.display.ambientWeather;
  display.calendarWeather =
    typeof display.calendarWeather === 'boolean'
      ? display.calendarWeather
      : DEFAULT_CONFIG.display.calendarWeather;

  const refresh = {
    ...DEFAULT_CONFIG.refresh,
    ...(partial?.refresh ?? {}),
  };
  refresh.calendarMinutes = clamp(refresh.calendarMinutes, 2, 120, DEFAULT_CONFIG.refresh.calendarMinutes);
  refresh.weatherMinutes = clamp(refresh.weatherMinutes, 5, 120, DEFAULT_CONFIG.refresh.weatherMinutes);

  const calendars = sanitizeCalendars(partial?.calendars);

  return {
    weather,
    display,
    refresh,
    calendars,
  };
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return mergeWithDefaults(parsed);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
      await saveConfig(DEFAULT_CONFIG);
      return structuredClone(DEFAULT_CONFIG);
    }
    console.error('[config] Failed to read config.json, using defaults:', err);
    return structuredClone(DEFAULT_CONFIG);
  }
}

export async function saveConfig(config: AppConfig): Promise<AppConfig> {
  const sanitized = mergeWithDefaults(config);
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tempPath = `${CONFIG_PATH}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(sanitized, null, 2)}\n`, 'utf-8');
  await fs.rename(tempPath, CONFIG_PATH);
  return sanitized;
}
