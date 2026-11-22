import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  AppConfig,
  CloudModuleId,
  CloudSnapshotRequest,
  CloudSnapshotResponse,
} from '../shared/types.js';
import { DEFAULT_CLOUD_CONFIG, getDataDir } from './config.js';

export function buildCloudSnapshotRequest(
  config: AppConfig,
  options?: { force?: boolean }
): { body: CloudSnapshotRequest; headers: Record<string, string> } {
  const cloud = config.cloud ?? DEFAULT_CLOUD_CONFIG;
  const modules = cloud.modules ?? DEFAULT_CLOUD_CONFIG.modules;

  const include: CloudModuleId[] = [];
  if (modules.weather) include.push('weather');
  if (modules.alerts) include.push('alerts');
  if (modules.aqi) include.push('aqi');
  if (modules.market) include.push('market');

  const hasTempest =
    Boolean(config.weather.tempestStationId && config.weather.tempestStationId > 0) &&
    Boolean(config.weather.tempestToken?.trim());

  const body: CloudSnapshotRequest = {
    include,
    location: {
      name: config.weather.name,
      lat: config.weather.latitude,
      lon: config.weather.longitude,
      timezone: config.weather.timezone,
      unit: config.weather.unit,
      ...(hasTempest ? { tempestStationId: config.weather.tempestStationId } : {}),
    },
    ...(modules.market ? { market: { symbols: modules.marketSymbols } } : {}),
    ...(options?.force ? { force: true } : {}),
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (cloud.apiKey?.trim()) {
    headers.Authorization = `Bearer ${cloud.apiKey.trim()}`;
  }
  if (hasTempest && config.weather.tempestToken?.trim()) {
    headers['X-Tempest-Token'] = config.weather.tempestToken.trim();
  }

  return { body, headers };
}

export class CloudSyncService {
  private cache: CloudSnapshotResponse | null = null;
  private etag: string | null = null;
  private lastError: string | undefined;
  private lastRequestKey = '';
  private readonly cachePath: string;

  constructor(cacheFilePath?: string) {
    this.cachePath = cacheFilePath ?? path.join(getDataDir(), 'cloud-cache.json');
  }

  async loadFromDisk(): Promise<void> {
    try {
      const raw = await fs.readFile(this.cachePath, 'utf-8');
      const parsed = JSON.parse(raw) as CloudSnapshotResponse;
      if (parsed && parsed.schemaVersion === 1) {
        this.cache = parsed;
      }
    } catch {
      // No disk cache yet or unreadable — ignore
    }
  }

  private async saveToDisk(snapshot: CloudSnapshotResponse): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.cachePath), { recursive: true });
      const tmp = `${this.cachePath}.tmp`;
      await fs.writeFile(tmp, `${JSON.stringify(snapshot)}\n`, 'utf-8');
      await fs.rename(tmp, this.cachePath);
    } catch (err) {
      console.error('[cloud] Failed to persist disk cache:', err);
    }
  }

  getSnapshot(): { data: CloudSnapshotResponse | null; error?: string } {
    return {
      data: this.cache,
      error: this.lastError,
    };
  }

  async refresh(
    config: AppConfig,
    options?: { force?: boolean }
  ): Promise<CloudSnapshotResponse | null> {
    const cloud = config.cloud;
    if (!cloud?.enabled || !cloud.endpointUrl.trim()) {
      return null;
    }

    const { body, headers } = buildCloudSnapshotRequest(config, options);
    if (body.include.length === 0) {
      this.cache = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
      };
      this.lastError = undefined;
      return this.cache;
    }

    const requestKey = JSON.stringify({
      url: cloud.endpointUrl.trim(),
      include: body.include,
      location: body.location,
      market: body.market,
      hasToken: Boolean(headers['X-Tempest-Token']),
    });

    if (requestKey !== this.lastRequestKey) {
      this.etag = null;
      this.lastRequestKey = requestKey;
    }

    if (this.etag && !options?.force) {
      headers['If-None-Match'] = this.etag;
    }

    try {
      const response = await fetch(cloud.endpointUrl.trim(), {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });

      if (response.status === 304 && this.cache) {
        this.lastError = undefined;
        if (this.cache.weather?.stale) {
          this.cache = {
            ...this.cache,
            weather: { ...this.cache.weather, stale: false },
          };
        }
        if (this.cache.market?.stale) {
          this.cache = {
            ...this.cache,
            market: { ...this.cache.market, stale: false },
          };
        }
        return this.cache;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(
          `Cloud API returned HTTP ${response.status}${text ? `: ${text.slice(0, 140)}` : ''}`
        );
      }

      const data = (await response.json()) as CloudSnapshotResponse;
      if (!data || data.schemaVersion !== 1) {
        throw new Error('Unexpected response format from Cloud API');
      }

      this.etag = response.headers.get('etag');
      this.cache = data;
      this.lastError = undefined;
      void this.saveToDisk(data);
      return this.cache;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Cloud sync failed';
      this.lastError = message;
      console.error('[cloud] Refresh failed:', message);

      if (this.cache) {
        this.cache = {
          ...this.cache,
          ...(this.cache.weather
            ? { weather: { ...this.cache.weather, stale: true } }
            : {}),
          ...(this.cache.market
            ? { market: { ...this.cache.market, stale: true } }
            : {}),
        };
      }
      return this.cache;
    }
  }
}

export async function testCloudEndpoint(config: AppConfig): Promise<{
  ok: boolean;
  generatedAt?: string;
  weatherSource?: string;
  temperature?: number;
  alertsCount?: number;
  usAqi?: number | null;
  marketSymbols?: string[];
  errors?: CloudSnapshotResponse['errors'];
  error?: string;
}> {
  const endpointUrl = config.cloud?.endpointUrl?.trim();
  if (!endpointUrl) {
    return { ok: false, error: 'Cloud API Endpoint URL is required' };
  }

  const { body, headers } = buildCloudSnapshotRequest(config, { force: true });
  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return {
        ok: false,
        error: `Cloud API returned HTTP ${response.status}${text ? `: ${text.slice(0, 140)}` : ''}`,
      };
    }

    const data = (await response.json()) as CloudSnapshotResponse;
    if (!data || data.schemaVersion !== 1) {
      return { ok: false, error: 'Unexpected response format (expected schemaVersion: 1)' };
    }

    return {
      ok: true,
      generatedAt: data.generatedAt,
      weatherSource: data.weather?.source,
      temperature: data.weather?.current.temperature,
      alertsCount: data.alerts?.length,
      usAqi: data.aqi ? data.aqi.usAqi : null,
      marketSymbols: data.market?.quotes.map((q) => q.symbol),
      errors: data.errors,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to connect to Cloud API',
    };
  }
}
