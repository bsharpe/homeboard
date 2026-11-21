import type {
  DailyForecastItem,
  GeocodingResult,
  HourlyForecastItem,
  TempestStationSummary,
  WeatherData,
  WeatherLocationConfig,
} from '../shared/types.js';

const WMO_DESCRIPTIONS: Record<number, string> = {
  0: 'Clear',
  1: 'Mostly Clear',
  2: 'Partly Cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Freezing Fog',
  51: 'Light Drizzle',
  53: 'Drizzle',
  55: 'Heavy Drizzle',
  56: 'Freezing Drizzle',
  57: 'Heavy Freezing Drizzle',
  61: 'Light Rain',
  63: 'Rain',
  65: 'Heavy Rain',
  66: 'Freezing Rain',
  67: 'Heavy Freezing Rain',
  71: 'Light Snow',
  73: 'Snow',
  75: 'Heavy Snow',
  77: 'Snow Grains',
  80: 'Light Showers',
  81: 'Showers',
  82: 'Heavy Showers',
  85: 'Snow Showers',
  86: 'Heavy Snow Showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm w/ Hail',
  99: 'Severe Thunderstorm',
};

export function describeWmoCode(code: number): string {
  return WMO_DESCRIPTIONS[code] ?? 'Unknown';
}

export function mapTempestIconToWmo(icon?: string): number {
  if (!icon) return 0;
  const normalized = icon.toLowerCase().trim();
  if (normalized.includes('thunderstorm')) return 95;
  if (normalized.includes('snow')) return 73;
  if (normalized.includes('sleet')) return 66;
  if (normalized.includes('possibly-rainy') || normalized.includes('chance-rain')) return 80;
  if (normalized.includes('rain')) return 63;
  if (normalized.includes('fog')) return 45;
  if (normalized.includes('partly-cloudy')) return 2;
  if (normalized.includes('cloudy')) return 3;
  if (normalized.includes('windy')) return 2;
  return 0; // clear-day, clear-night
}

export function epochToLocalIso(epochSec: number, timeZone: string): string {
  const date = new Date(epochSec * 1000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  const rawHour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const hour = rawHour === '24' ? '00' : rawHour;
  const min = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${y}-${m}-${d}T${hour}:${min}`;
}

export function epochToLocalDateKey(epochSec: number, timeZone: string): string {
  return epochToLocalIso(epochSec, timeZone).slice(0, 10);
}

export interface TempestBetterForecastResponse {
  status?: {
    status_code: number;
    status_message: string;
  };
  location_name?: string;
  timezone?: string;
  current_conditions?: {
    time: number;
    conditions?: string;
    icon?: string;
    air_temperature?: number;
    feels_like?: number;
    relative_humidity?: number;
    wind_avg?: number;
    wind_speed?: number;
    wind_gust?: number;
    uv?: number;
    pressure_trend?: string;
    precip_accum_local_day?: number;
    lightning_strike_count_last_1hr?: number;
    lightning_strike_last_distance?: number;
  };
  forecast?: {
    hourly?: Array<{
      time: number;
      conditions?: string;
      icon?: string;
      air_temperature?: number;
      precip_probability?: number;
    }>;
    daily?: Array<{
      day_start_local: number;
      conditions?: string;
      icon?: string;
      air_temp_high?: number;
      air_temp_low?: number;
      precip_probability?: number;
      sunrise?: number;
      sunset?: number;
    }>;
  };
}

export function parseTempestBetterForecast(
  raw: TempestBetterForecastResponse,
  location: Pick<WeatherLocationConfig, 'name' | 'unit' | 'timezone'>
): WeatherData {
  if (raw.status && raw.status.status_code !== 0) {
    throw new Error(raw.status.status_message || `Tempest API error (${raw.status.status_code})`);
  }
  const cur = raw.current_conditions;
  if (!cur) {
    throw new Error('Incomplete weather payload from Tempest');
  }

  const timeZone = raw.timezone || location.timezone || 'America/Denver';
  const rawDaily = raw.forecast?.daily ?? [];
  const rawHourly = raw.forecast?.hourly ?? [];

  const daily: DailyForecastItem[] = rawDaily.slice(0, 10).map((day) => {
    const code = mapTempestIconToWmo(day.icon);
    return {
      date: epochToLocalDateKey(day.day_start_local, timeZone),
      weatherCode: code,
      condition: day.conditions || describeWmoCode(code),
      tempMax: Math.round(day.air_temp_high ?? 0),
      tempMin: Math.round(day.air_temp_low ?? 0),
      precipitationProbability: Math.round(day.precip_probability ?? 0),
      sunrise: day.sunrise ? epochToLocalIso(day.sunrise, timeZone) : '',
      sunset: day.sunset ? epochToLocalIso(day.sunset, timeZone) : '',
    };
  });

  const todayRaw = rawDaily[0];
  const curIcon = cur.icon ?? '';
  const isDay =
    curIcon.endsWith('-night')
      ? false
      : curIcon.endsWith('-day')
        ? true
        : todayRaw?.sunrise && todayRaw?.sunset
          ? cur.time >= todayRaw.sunrise && cur.time < todayRaw.sunset
          : true;

  const upcomingHourly = rawHourly.filter((slot) => slot.time > cur.time);
  const hourlySource = upcomingHourly.length > 0 ? upcomingHourly : rawHourly;

  const hourly: HourlyForecastItem[] = hourlySource.slice(0, 12).map((slot) => {
    const code = mapTempestIconToWmo(slot.icon);
    const slotIcon = slot.icon ?? '';
    const slotIsDay = slotIcon.endsWith('-night')
      ? false
      : slotIcon.endsWith('-day')
        ? true
        : (() => {
            const localHour = Number(epochToLocalIso(slot.time, timeZone).slice(11, 13));
            return localHour >= 6 && localHour < 19;
          })();
    return {
      time: epochToLocalIso(slot.time, timeZone),
      temperature: Math.round(slot.air_temperature ?? 0),
      weatherCode: code,
      condition: slot.conditions || describeWmoCode(code),
      precipitationProbability: Math.round(slot.precip_probability ?? 0),
      isDay: slotIsDay,
    };
  });

  const curCode = mapTempestIconToWmo(cur.icon);
  const windSpeedVal = cur.wind_avg ?? cur.wind_speed ?? 0;
  const windGustVal =
    typeof cur.wind_gust === 'number' && Number.isFinite(cur.wind_gust)
      ? Math.round(cur.wind_gust)
      : undefined;
  const precipVal =
    typeof cur.precip_accum_local_day === 'number' && cur.precip_accum_local_day > 0
      ? Math.round(cur.precip_accum_local_day * 100) / 100
      : undefined;
  const lightningCount =
    typeof cur.lightning_strike_count_last_1hr === 'number' &&
    cur.lightning_strike_count_last_1hr > 0
      ? cur.lightning_strike_count_last_1hr
      : undefined;
  const lightningLastDist =
    lightningCount && typeof cur.lightning_strike_last_distance === 'number'
      ? Math.round(cur.lightning_strike_last_distance)
      : undefined;

  return {
    source: 'tempest',
    locationName: location.name || raw.location_name || 'Tempest Station',
    unit: location.unit,
    timezone: timeZone,
    fetchedAt: new Date().toISOString(),
    stale: false,
    current: {
      temperature: Math.round(cur.air_temperature ?? 0),
      apparentTemperature: Math.round(cur.feels_like ?? cur.air_temperature ?? 0),
      humidity: Math.round(cur.relative_humidity ?? 0),
      windSpeed: Math.round(windSpeedVal),
      windGust: windGustVal,
      weatherCode: curCode,
      condition: cur.conditions || describeWmoCode(curCode),
      isDay,
      uvIndex: Math.round((cur.uv ?? 0) * 10) / 10,
      precipToday: precipVal,
      pressureTrend: cur.pressure_trend,
      lightningCount,
      lightningLastDist,
    },
    hourly,
    daily,
  };
}

interface OpenMeteoResponse {
  current?: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    weather_code: number;
    is_day: number;
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
    precipitation_probability: number[];
    is_day: number[];
    uv_index?: number[];
  };
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
    sunrise: string[];
    sunset: string[];
  };
}

export class WeatherService {
  private cache: WeatherData | null = null;
  private lastError: string | undefined;
  private lastKey = '';

  getSnapshot(): { data: WeatherData | null; error?: string } {
    return { data: this.cache, error: this.lastError };
  }

  async refresh(location: WeatherLocationConfig): Promise<WeatherData | null> {
    const useTempest =
      location.provider === 'tempest' &&
      Boolean(location.tempestToken) &&
      Boolean(location.tempestStationId);

    const key = useTempest
      ? `tempest:${location.tempestStationId}:${location.unit}:${location.timezone}`
      : `open-meteo:${location.latitude.toFixed(4)},${location.longitude.toFixed(4)},${location.unit},${location.timezone}`;

    if (key !== this.lastKey) {
      this.cache = null;
      this.lastKey = key;
    }

    if (useTempest) {
      try {
        this.cache = await fetchTempestBetterForecast(
          location.tempestToken!,
          location.tempestStationId!,
          location
        );
        this.lastError = undefined;
        return this.cache;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Tempest weather fetch failed';
        this.lastError = message;
        console.error('[weather:tempest] Refresh failed:', message);
        if (this.cache) {
          this.cache = { ...this.cache, stale: true };
        }
        return this.cache;
      }
    }

    const params = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      timezone: location.timezone,
      temperature_unit: location.unit,
      wind_speed_unit: location.unit === 'fahrenheit' ? 'mph' : 'kmh',
      forecast_days: '7',
      current: [
        'temperature_2m',
        'apparent_temperature',
        'relative_humidity_2m',
        'wind_speed_10m',
        'weather_code',
        'is_day',
      ].join(','),
      hourly: [
        'temperature_2m',
        'weather_code',
        'precipitation_probability',
        'is_day',
        'uv_index',
      ].join(','),
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_probability_max',
        'sunrise',
        'sunset',
      ].join(','),
    });

    const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(12_000),
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Open-Meteo returned HTTP ${response.status}`);
      }

      const raw = (await response.json()) as OpenMeteoResponse;
      if (!raw.current || !raw.hourly || !raw.daily) {
        throw new Error('Incomplete weather payload from Open-Meteo');
      }

      const currentHourPrefix = raw.current.time.slice(0, 13); // YYYY-MM-DDTHH
      const startIndex = Math.max(
        0,
        raw.hourly.time.findIndex((t) => t.slice(0, 13) >= currentHourPrefix)
      );

      const currentUv = raw.hourly.uv_index?.[startIndex] ?? 0;

      const hourly: HourlyForecastItem[] = [];
      for (let i = startIndex + 1; i < Math.min(raw.hourly.time.length, startIndex + 13); i++) {
        const code = raw.hourly.weather_code[i] ?? 0;
        hourly.push({
          time: raw.hourly.time[i],
          temperature: Math.round(raw.hourly.temperature_2m[i] ?? 0),
          weatherCode: code,
          condition: describeWmoCode(code),
          precipitationProbability: Math.round(raw.hourly.precipitation_probability[i] ?? 0),
          isDay: raw.hourly.is_day[i] === 1,
        });
      }

      const daily: DailyForecastItem[] = raw.daily.time.map((date, idx) => {
        const code = raw.daily!.weather_code[idx] ?? 0;
        return {
          date,
          weatherCode: code,
          condition: describeWmoCode(code),
          tempMax: Math.round(raw.daily!.temperature_2m_max[idx] ?? 0),
          tempMin: Math.round(raw.daily!.temperature_2m_min[idx] ?? 0),
          precipitationProbability: Math.round(raw.daily!.precipitation_probability_max[idx] ?? 0),
          sunrise: raw.daily!.sunrise[idx] ?? '',
          sunset: raw.daily!.sunset[idx] ?? '',
        };
      });

      this.cache = {
        source: 'open-meteo',
        locationName: location.name,
        unit: location.unit,
        timezone: location.timezone,
        fetchedAt: new Date().toISOString(),
        stale: false,
        current: {
          temperature: Math.round(raw.current.temperature_2m),
          apparentTemperature: Math.round(raw.current.apparent_temperature),
          humidity: Math.round(raw.current.relative_humidity_2m),
          windSpeed: Math.round(raw.current.wind_speed_10m),
          weatherCode: raw.current.weather_code,
          condition: describeWmoCode(raw.current.weather_code),
          isDay: raw.current.is_day === 1,
          uvIndex: Math.round(currentUv * 10) / 10,
        },
        hourly,
        daily,
      };
      this.lastError = undefined;
      return this.cache;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Weather fetch failed';
      this.lastError = message;
      console.error('[weather] Refresh failed:', message);
      if (this.cache) {
        this.cache = { ...this.cache, stale: true };
      }
      return this.cache;
    }
  }
}

export async function searchLocations(query: string): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const params = new URLSearchParams({
    name: trimmed,
    count: '6',
    language: 'en',
    format: 'json',
  });

  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`, {
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error(`Geocoding failed with HTTP ${response.status}`);
  }
  const data = (await response.json()) as { results?: GeocodingResult[] };
  return (data.results ?? []).map((item) => ({
    name: item.name,
    admin1: item.admin1,
    country: item.country,
    latitude: item.latitude,
    longitude: item.longitude,
    timezone: item.timezone || 'America/Denver',
  }));
}

export async function fetchTempestBetterForecast(
  token: string,
  stationId: number,
  location: Pick<WeatherLocationConfig, 'name' | 'unit' | 'timezone'>
): Promise<WeatherData> {
  const isMetric = location.unit === 'celsius';
  const params = new URLSearchParams({
    station_id: String(stationId),
    token: token.trim(),
    units_temp: isMetric ? 'c' : 'f',
    units_wind: isMetric ? 'kph' : 'mph',
    units_precip: isMetric ? 'mm' : 'in',
    units_distance: isMetric ? 'km' : 'mi',
    units_pressure: isMetric ? 'mb' : 'inhg',
  });

  const url = `https://swd.weatherflow.com/swd/rest/better_forecast?${params.toString()}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12_000),
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Tempest API returned HTTP ${response.status}`);
  }

  const raw = (await response.json()) as TempestBetterForecastResponse;
  return parseTempestBetterForecast(raw, location);
}

interface TempestStationsResponse {
  status?: {
    status_code: number;
    status_message: string;
  };
  stations?: Array<{
    station_id: number;
    name?: string;
    public_name?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
  }>;
}

export async function discoverTempestStations(token: string): Promise<TempestStationSummary[]> {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error('Tempest Personal Access Token is required');
  }

  const params = new URLSearchParams({ token: trimmed });
  const response = await fetch(
    `https://swd.weatherflow.com/swd/rest/stations?${params.toString()}`,
    {
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: 'application/json' },
    }
  );

  if (!response.ok) {
    throw new Error(`Tempest stations request failed (HTTP ${response.status})`);
  }

  const data = (await response.json()) as TempestStationsResponse;
  if (data.status && data.status.status_code !== 0) {
    throw new Error(data.status.status_message || 'Failed to fetch Tempest stations');
  }

  return (data.stations ?? [])
    .filter((s) => typeof s.station_id === 'number')
    .map((s) => ({
      stationId: s.station_id,
      name: s.public_name || s.name || `Station ${s.station_id}`,
      latitude: s.latitude ?? 35.687,
      longitude: s.longitude ?? -105.9378,
      timezone: s.timezone || 'America/Denver',
    }));
}
