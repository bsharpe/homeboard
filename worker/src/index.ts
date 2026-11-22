import type {
  CloudModuleId,
  CloudSnapshotRequest,
  CloudSnapshotResponse,
} from '../../shared/types.js';
import { CacheStore, type KVLike } from './cache.js';
import { resolveAlerts } from './modules/alerts.js';
import { resolveAirQuality } from './modules/aqi.js';
import { resolveMarket } from './modules/market.js';
import { resolveWeather } from './modules/weather.js';

export interface WorkerEnv {
  CACHE?: KVLike;
  API_KEY?: string;
  TEMPEST_TOKEN?: string;
  TEMPEST_STATION_ID?: string;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tempest-Token, If-None-Match',
  'Access-Control-Expose-Headers': 'ETag',
};

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

function isAuthorized(request: Request, env: WorkerEnv): boolean {
  const configured = env.API_KEY?.trim();
  if (!configured) return true;

  const allowedKeys = configured
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  if (allowedKeys.length === 0) return true;

  const authHeader = request.headers.get('Authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  return allowedKeys.includes(match[1].trim());
}

async function computeWeakEtag(payload: CloudSnapshotResponse): Promise<string> {
  // Exclude volatile generatedAt so unchanged cached modules yield the same ETag
  const stable = {
    schemaVersion: payload.schemaVersion,
    weather: payload.weather,
    alerts: payload.alerts,
    aqi: payload.aqi,
    market: payload.market,
    errors: payload.errors,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(stable));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `W/"${hex}"`;
}

export async function handleRequest(
  request: Request,
  env: WorkerEnv,
  options?: { cache?: CacheStore; fetchFn?: typeof fetch }
): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    return jsonResponse({
      ok: true,
      service: 'homeboard-cloud',
      schemaVersion: 1,
      time: new Date().toISOString(),
    });
  }

  if (request.method === 'POST' && url.pathname === '/v1/snapshot') {
    if (!isAuthorized(request, env)) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    let body: CloudSnapshotRequest;
    try {
      body = (await request.json()) as CloudSnapshotRequest;
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    if (!Array.isArray(body?.include) || !body?.location) {
      return jsonResponse({ error: 'Request must include "include" array and "location"' }, 400);
    }

    const lat = Number(body.location.lat);
    const lon = Number(body.location.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return jsonResponse({ error: 'Valid numeric location.lat and location.lon are required' }, 400);
    }

    const requested = new Set<CloudModuleId>(
      body.include.filter((m): m is CloudModuleId =>
        m === 'weather' || m === 'alerts' || m === 'aqi' || m === 'market'
      )
    );

    const cache = options?.cache ?? new CacheStore(env.CACHE);
    const fetchFn = options?.fetchFn ?? fetch;
    const force = Boolean(body.force);

    // Pass-through Tempest PAT from request header (never logged or cached),
    // with optional Worker secret fallback for personal deployments.
    const tempestToken =
      request.headers.get('X-Tempest-Token')?.trim() || env.TEMPEST_TOKEN?.trim() || undefined;
    const rawStationId =
      body.location.tempestStationId ??
      (env.TEMPEST_STATION_ID ? Number(env.TEMPEST_STATION_ID) : undefined);
    const tempestStationId =
      typeof rawStationId === 'number' && Number.isFinite(rawStationId) && rawStationId > 0
        ? Math.round(rawStationId)
        : undefined;

    const unit = body.location.unit === 'celsius' ? 'celsius' : 'fahrenheit';
    const timezone = body.location.timezone || 'America/Denver';
    const locationName = body.location.name || '';

    const responsePayload: CloudSnapshotResponse = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
    };
    const errors: Partial<Record<CloudModuleId, string>> = {};

    const tasks: Array<Promise<void>> = [];

    if (requested.has('weather')) {
      tasks.push(
        resolveWeather(
          {
            name: locationName,
            lat,
            lon,
            timezone,
            unit,
            tempestStationId,
            tempestToken,
            force,
          },
          cache,
          fetchFn
        )
          .then((data) => {
            responsePayload.weather = data;
          })
          .catch((err: unknown) => {
            errors.weather = err instanceof Error ? err.message : 'Weather fetch failed';
          })
      );
    }

    if (requested.has('alerts')) {
      tasks.push(
        resolveAlerts(lat, lon, cache, { force, fetchFn })
          .then((alerts) => {
            responsePayload.alerts = alerts;
          })
          .catch((err: unknown) => {
            errors.alerts = err instanceof Error ? err.message : 'Alerts fetch failed';
          })
      );
    }

    if (requested.has('aqi')) {
      tasks.push(
        resolveAirQuality(lat, lon, cache, { force, fetchFn })
          .then((aqi) => {
            responsePayload.aqi = aqi;
          })
          .catch((err: unknown) => {
            errors.aqi = err instanceof Error ? err.message : 'Air quality fetch failed';
          })
      );
    }

    if (requested.has('market')) {
      const symbols = Array.isArray(body.market?.symbols) ? body.market.symbols : ['SPY', 'QQQ'];
      tasks.push(
        resolveMarket(symbols, cache, { force, fetchFn })
          .then((market) => {
            responsePayload.market = market;
          })
          .catch((err: unknown) => {
            errors.market = err instanceof Error ? err.message : 'Market fetch failed';
          })
      );
    }

    await Promise.all(tasks);

    if (Object.keys(errors).length > 0) {
      responsePayload.errors = errors;
    }

    const etag = await computeWeakEtag(responsePayload);
    const ifNoneMatch = request.headers.get('If-None-Match');
    if (ifNoneMatch && ifNoneMatch === etag && !force) {
      return new Response(null, {
        status: 304,
        headers: { ...CORS_HEADERS, ETag: etag },
      });
    }

    return jsonResponse(responsePayload, 200, { ETag: etag });
  }

  return jsonResponse({ error: 'Not Found' }, 404);
}

export default {
  fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return handleRequest(request, env);
  },
};
