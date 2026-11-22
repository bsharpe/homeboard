import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  AppConfig,
  BoardSlideId,
  CalendarFeedConfig,
  CloudConfig,
  WorldClockCity,
} from '../shared/types.js';

export const DEFAULT_ROTATION_SLIDES: BoardSlideId[] = [
  'calendar',
  'stocks',
  'world-clock',
  'forecast-radar',
];

export const DEFAULT_WORLD_CLOCK_CITIES: WorldClockCity[] = [
  { id: 'santa-fe', name: 'Santa Fe', timezone: 'America/Denver', subtitle: 'New Mexico' },
  { id: 'memphis', name: 'Memphis', timezone: 'America/Chicago', subtitle: 'Tennessee' },
  { id: 'miami', name: 'Miami', timezone: 'America/New_York', subtitle: 'Florida' },
];

export const DEFAULT_CLOUD_CONFIG: CloudConfig = {
  enabled: false,
  endpointUrl: '',
  pollSeconds: 120,
  modules: {
    weather: true,
    alerts: true,
    aqi: true,
    market: true,
    marketSymbols: ['SPY', 'QQQ'],
  },
};

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
    rotationEnabled: true,
    rotationIntervalSeconds: 25,
    rotationSlides: [...DEFAULT_ROTATION_SLIDES],
    worldClockCities: structuredClone(DEFAULT_WORLD_CLOCK_CITIES),
  },
  refresh: {
    calendarMinutes: 10,
    weatherMinutes: 15,
  },
  calendars: [],
  cloud: structuredClone(DEFAULT_CLOUD_CONFIG),
};

const DATA_DIR = process.env.HOMEBOARD_DATA_DIR
  ? path.resolve(process.env.HOMEBOARD_DATA_DIR)
  : path.resolve(process.cwd(), 'data');

const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

export function getDataDir(): string {
  return DATA_DIR;
}

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
      abbreviation:
        typeof item.abbreviation === 'string' && item.abbreviation.trim().length > 0
          ? item.abbreviation.trim().slice(0, 2).toUpperCase()
          : undefined,
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
  display.rotationEnabled =
    typeof display.rotationEnabled === 'boolean'
      ? display.rotationEnabled
      : true;
  display.rotationIntervalSeconds = clamp(
    display.rotationIntervalSeconds ?? 25,
    10,
    300,
    25
  );
  const validSlideSet = new Set<BoardSlideId>(DEFAULT_ROTATION_SLIDES);
  const rawSlides = Array.isArray(partial?.display?.rotationSlides)
    ? partial.display.rotationSlides.filter((s): s is BoardSlideId => validSlideSet.has(s))
    : DEFAULT_ROTATION_SLIDES;
  display.rotationSlides =
    rawSlides.length > 0 ? Array.from(new Set(rawSlides)) : [...DEFAULT_ROTATION_SLIDES];

  const rawCities = Array.isArray(partial?.display?.worldClockCities)
    ? partial.display.worldClockCities
        .filter((c): c is WorldClockCity => Boolean(c && typeof c === 'object'))
        .map((c, idx) => ({
          id: typeof c.id === 'string' && c.id.trim() ? c.id.trim() : `city-${idx + 1}`,
          name: typeof c.name === 'string' ? c.name.trim() : '',
          timezone: typeof c.timezone === 'string' ? c.timezone.trim() : '',
          subtitle:
            typeof c.subtitle === 'string' && c.subtitle.trim() ? c.subtitle.trim() : undefined,
        }))
        .filter((c) => c.name.length > 0 && c.timezone.length > 0)
        .slice(0, 6)
    : [];
  display.worldClockCities =
    rawCities.length > 0 ? rawCities : structuredClone(DEFAULT_WORLD_CLOCK_CITIES);

  const refresh = {
    ...DEFAULT_CONFIG.refresh,
    ...(partial?.refresh ?? {}),
  };
  refresh.calendarMinutes = clamp(refresh.calendarMinutes, 2, 120, DEFAULT_CONFIG.refresh.calendarMinutes);
  refresh.weatherMinutes = clamp(refresh.weatherMinutes, 5, 120, DEFAULT_CONFIG.refresh.weatherMinutes);

  const calendars = sanitizeCalendars(partial?.calendars);

  const rawCloud = partial?.cloud;
  const rawSymbols = Array.isArray(rawCloud?.modules?.marketSymbols)
    ? rawCloud.modules.marketSymbols
    : DEFAULT_CLOUD_CONFIG.modules.marketSymbols;
  const cleanedSymbols = Array.from(
    new Set(
      rawSymbols
        .filter((s): s is string => typeof s === 'string')
        .map((s) => s.trim().toUpperCase())
        .filter((s) => /^[A-Z0-9.^=-]{1,12}$/.test(s))
    )
  ).slice(0, 10);

  const cloud: CloudConfig = {
    enabled: typeof rawCloud?.enabled === 'boolean' ? rawCloud.enabled : DEFAULT_CLOUD_CONFIG.enabled,
    endpointUrl:
      typeof rawCloud?.endpointUrl === 'string' ? rawCloud.endpointUrl.trim() : '',
    apiKey:
      typeof rawCloud?.apiKey === 'string' && rawCloud.apiKey.trim().length > 0
        ? rawCloud.apiKey.trim()
        : undefined,
    pollSeconds: clamp(
      rawCloud?.pollSeconds ?? DEFAULT_CLOUD_CONFIG.pollSeconds,
      30,
      900,
      DEFAULT_CLOUD_CONFIG.pollSeconds
    ),
    modules: {
      weather:
        typeof rawCloud?.modules?.weather === 'boolean'
          ? rawCloud.modules.weather
          : DEFAULT_CLOUD_CONFIG.modules.weather,
      alerts:
        typeof rawCloud?.modules?.alerts === 'boolean'
          ? rawCloud.modules.alerts
          : DEFAULT_CLOUD_CONFIG.modules.alerts,
      aqi:
        typeof rawCloud?.modules?.aqi === 'boolean'
          ? rawCloud.modules.aqi
          : DEFAULT_CLOUD_CONFIG.modules.aqi,
      market:
        typeof rawCloud?.modules?.market === 'boolean'
          ? rawCloud.modules.market
          : DEFAULT_CLOUD_CONFIG.modules.market,
      marketSymbols: cleanedSymbols.length > 0 ? cleanedSymbols : ['SPY', 'QQQ'],
    },
  };

  return {
    weather,
    display,
    refresh,
    calendars,
    cloud,
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
