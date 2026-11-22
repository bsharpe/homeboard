import { describe, expect, it, vi } from 'vitest';
import type { CloudSnapshotResponse } from '../../shared/types.js';
import { CacheStore } from './cache.js';
import { handleRequest } from './index.js';

const SAMPLE_TEMPEST_PAYLOAD = {
  status: { status_code: 0, status_message: 'SUCCESS' },
  location_name: 'Armenta St',
  timezone: 'America/Denver',
  current_conditions: {
    time: 1700000000,
    conditions: 'Clear',
    icon: 'clear-day',
    air_temperature: 61,
    feels_like: 60,
    relative_humidity: 25,
    wind_avg: 5,
    uv: 4.2,
  },
  forecast: {
    hourly: [
      {
        time: 1700003600,
        conditions: 'Clear',
        icon: 'clear-day',
        air_temperature: 63,
        precip_probability: 0,
      },
    ],
    daily: [
      {
        day_start_local: 1699945200,
        conditions: 'Clear',
        icon: 'clear-day',
        air_temp_high: 65,
        air_temp_low: 34,
        precip_probability: 5,
        sunrise: 1699968000,
        sunset: 1700005000,
      },
    ],
  },
};

const SAMPLE_OPEN_METEO_PAYLOAD = {
  current: {
    time: '2026-11-22T09:00',
    temperature_2m: 48,
    apparent_temperature: 45,
    relative_humidity_2m: 40,
    wind_speed_10m: 8,
    weather_code: 2,
    is_day: 1,
  },
  hourly: {
    time: ['2026-11-22T09:00', '2026-11-22T10:00'],
    temperature_2m: [48, 51],
    weather_code: [2, 1],
    precipitation_probability: [10, 5],
    is_day: [1, 1],
    uv_index: [2.5, 3.1],
  },
  daily: {
    time: ['2026-11-22'],
    weather_code: [2],
    temperature_2m_max: [58],
    temperature_2m_min: [31],
    precipitation_probability_max: [10],
    sunrise: ['2026-11-22T06:51'],
    sunset: ['2026-11-22T16:56'],
  },
};

const SAMPLE_NWS_PAYLOAD = {
  features: [
    {
      id: 'alert-minor',
      properties: {
        id: 'alert-minor',
        event: 'Wind Advisory',
        headline: 'Wind Advisory in effect until 6 PM',
        severity: 'Moderate',
      },
    },
    {
      id: 'alert-severe',
      properties: {
        id: 'alert-severe',
        event: 'Winter Storm Warning',
        headline: 'Heavy snow expected tonight',
        severity: 'Severe',
      },
    },
  ],
};

const SAMPLE_AQI_PAYLOAD = {
  current: {
    time: '2026-11-22T09:00',
    us_aqi: 32,
    pm2_5: 5.4,
    pm10: 11.2,
    ozone: 62.0,
  },
};

const SAMPLE_YAHOO_PAYLOAD = {
  chart: {
    result: [
      {
        meta: {
          symbol: 'SPY',
          regularMarketPrice: 605.5,
          regularMarketTime: 1700000000,
          previousClose: 600.0,
        },
        timestamp: [1699900000, 1700000000],
        indicators: { quote: [{ close: [600.0, 605.5] }] },
      },
    ],
  },
};

describe('Cloudflare Worker /v1/snapshot', () => {
  it('returns health check', async () => {
    const res = await handleRequest(new Request('https://worker.test/health'), {});
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; schemaVersion: number };
    expect(json.ok).toBe(true);
    expect(json.schemaVersion).toBe(1);
  });

  it('enforces multi-family Bearer API keys when API_KEY is configured', async () => {
    const req = new Request('https://worker.test/v1/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        include: ['weather'],
        location: { name: 'Santa Fe', lat: 35.68, lon: -105.93, timezone: 'America/Denver', unit: 'fahrenheit' },
      }),
    });
    const res = await handleRequest(req, { API_KEY: 'fam-a, fam-b' });
    expect(res.status).toBe(401);
  });

  it('uses Tempest when X-Tempest-Token + stationId are present, and skips unrequested modules', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('swd.weatherflow.com')) {
        return new Response(JSON.stringify(SAMPLE_TEMPEST_PAYLOAD), { status: 200 });
      }
      throw new Error(`Unexpected upstream call: ${url}`);
    });

    const cache = new CacheStore();
    const req = new Request('https://worker.test/v1/snapshot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer fam-a',
        'X-Tempest-Token': 'pat-123',
      },
      body: JSON.stringify({
        include: ['weather'],
        location: {
          name: 'Home',
          lat: 35.67,
          lon: -105.93,
          timezone: 'America/Denver',
          unit: 'fahrenheit',
          tempestStationId: 81382,
        },
      }),
    });

    const res = await handleRequest(req, { API_KEY: 'fam-a, fam-b' }, { cache, fetchFn: fetchMock });
    expect(res.status).toBe(200);
    const json = (await res.json()) as CloudSnapshotResponse;
    expect(json.weather?.source).toBe('tempest');
    expect(json.weather?.current.temperature).toBe(61);
    expect(json.market).toBeUndefined();
    expect(json.alerts).toBeUndefined();
    expect(json.aqi).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Repeat with ETag -> 304 Not Modified without any upstream calls
    const etag = res.headers.get('ETag')!;
    expect(etag).toBeTruthy();
    const req2 = new Request('https://worker.test/v1/snapshot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer fam-a',
        'X-Tempest-Token': 'pat-123',
        'If-None-Match': etag,
      },
      body: JSON.stringify({
        include: ['weather'],
        location: {
          name: 'Home',
          lat: 35.67,
          lon: -105.93,
          timezone: 'America/Denver',
          unit: 'fahrenheit',
          tempestStationId: 81382,
        },
      }),
    });
    const res2 = await handleRequest(req2, { API_KEY: 'fam-a, fam-b' }, { cache, fetchFn: fetchMock });
    expect(res2.status).toBe(304);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('automatically falls back to Open-Meteo when Tempest fails, and resolves alerts + aqi + market', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('swd.weatherflow.com')) {
        return new Response('Tempest down', { status: 503 });
      }
      if (url.includes('air-quality-api.open-meteo.com')) {
        return new Response(JSON.stringify(SAMPLE_AQI_PAYLOAD), { status: 200 });
      }
      if (url.includes('api.open-meteo.com')) {
        return new Response(JSON.stringify(SAMPLE_OPEN_METEO_PAYLOAD), { status: 200 });
      }
      if (url.includes('api.weather.gov')) {
        return new Response(JSON.stringify(SAMPLE_NWS_PAYLOAD), { status: 200 });
      }
      if (url.includes('finance.yahoo.com')) {
        return new Response(JSON.stringify(SAMPLE_YAHOO_PAYLOAD), { status: 200 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const cache = new CacheStore();
    const req = new Request('https://worker.test/v1/snapshot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tempest-Token': 'pat-broken',
      },
      body: JSON.stringify({
        include: ['weather', 'alerts', 'aqi', 'market'],
        location: {
          name: 'Santa Fe, NM',
          lat: 35.68,
          lon: -105.94,
          timezone: 'America/Denver',
          unit: 'fahrenheit',
          tempestStationId: 99999,
        },
        market: { symbols: ['SPY'] },
      }),
    });

    const res = await handleRequest(req, {}, { cache, fetchFn: fetchMock });
    expect(res.status).toBe(200);
    const json = (await res.json()) as CloudSnapshotResponse;

    expect(json.weather?.source).toBe('open-meteo');
    expect(json.weather?.current.temperature).toBe(48);
    expect(json.alerts?.map((a) => a.event)).toEqual(['Winter Storm Warning', 'Wind Advisory']);
    expect(json.aqi?.usAqi).toBe(32);
    expect(json.aqi?.category).toBe('Good');
    expect(json.market?.quotes[0].symbol).toBe('SPY');
    expect(json.errors).toBeUndefined();
  });
});
