import type {
  DailyForecastItem,
  GeocodingResult,
  HourlyForecastItem,
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
    const key = `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)},${location.unit},${location.timezone}`;
    if (key !== this.lastKey) {
      this.cache = null;
      this.lastKey = key;
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
