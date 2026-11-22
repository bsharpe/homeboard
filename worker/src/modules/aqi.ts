import type { AirQualityCategory, AirQualityData } from '../../../shared/types.js';
import { CacheStore, roundCoord } from '../cache.js';

const AQI_TTL_SEC = 900; // 15 minutes

export function categorizeUsAqi(aqi: number): AirQualityCategory {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Sensitive';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

interface OpenMeteoAqiResponse {
  current?: {
    time?: string;
    us_aqi?: number | null;
    pm2_5?: number | null;
    pm10?: number | null;
    ozone?: number | null;
  };
}

export async function resolveAirQuality(
  lat: number,
  lon: number,
  cache: CacheStore,
  options?: { force?: boolean; fetchFn?: typeof fetch }
): Promise<AirQualityData | null> {
  const fetchFn = options?.fetchFn ?? fetch;
  const cacheKey = `aqi:om:${roundCoord(lat)},${roundCoord(lon)}`;

  if (!options?.force) {
    const cached = await cache.getJson<AirQualityData>(cacheKey);
    if (cached) return cached;
  }

  const query = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'us_aqi,pm2_5,pm10,ozone',
  });

  const res = await fetchFn(
    `https://air-quality-api.open-meteo.com/v1/air-quality?${query.toString()}`,
    { headers: { Accept: 'application/json' } }
  );
  if (!res.ok) {
    throw new Error(`Open-Meteo Air Quality returned HTTP ${res.status}`);
  }

  const raw = (await res.json()) as OpenMeteoAqiResponse;
  const usAqiRaw = raw.current?.us_aqi;
  if (typeof usAqiRaw !== 'number' || !Number.isFinite(usAqiRaw)) {
    return null;
  }

  const usAqi = Math.max(0, Math.round(usAqiRaw));
  const data: AirQualityData = {
    usAqi,
    category: categorizeUsAqi(usAqi),
    pm25:
      typeof raw.current?.pm2_5 === 'number'
        ? Math.round(raw.current.pm2_5 * 10) / 10
        : undefined,
    pm10:
      typeof raw.current?.pm10 === 'number'
        ? Math.round(raw.current.pm10 * 10) / 10
        : undefined,
    ozone:
      typeof raw.current?.ozone === 'number'
        ? Math.round(raw.current.ozone * 10) / 10
        : undefined,
    fetchedAt: new Date().toISOString(),
  };

  await cache.setJson(cacheKey, data, AQI_TTL_SEC);
  return data;
}
