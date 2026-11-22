import { describe, expect, it, vi, afterEach } from 'vitest';
import type { AppConfig, CloudSnapshotResponse } from '../shared/types.js';
import { DEFAULT_CONFIG } from './config.js';
import { buildCloudSnapshotRequest, CloudSyncService } from './cloud.js';

function makeConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    ...structuredClone(DEFAULT_CONFIG),
    ...overrides,
  };
}

describe('buildCloudSnapshotRequest', () => {
  it('only includes enabled modules and omits market when disabled', () => {
    const config = makeConfig({
      cloud: {
        enabled: true,
        endpointUrl: 'https://api.example.com/v1/snapshot',
        apiKey: 'family-key-123',
        pollSeconds: 120,
        modules: {
          weather: true,
          alerts: true,
          aqi: false,
          market: false,
          marketSymbols: ['SPY', 'QQQ'],
        },
      },
    });

    const { body, headers } = buildCloudSnapshotRequest(config);
    expect(body.include).toEqual(['weather', 'alerts']);
    expect(body.market).toBeUndefined();
    expect(headers.Authorization).toBe('Bearer family-key-123');
    expect(headers['X-Tempest-Token']).toBeUndefined();
    expect(body.location.tempestStationId).toBeUndefined();
  });

  it('passes X-Tempest-Token and tempestStationId when Tempest is configured', () => {
    const config = makeConfig({
      weather: {
        ...DEFAULT_CONFIG.weather,
        tempestToken: 'pat-secret-123',
        tempestStationId: 81382,
      },
      cloud: {
        enabled: true,
        endpointUrl: 'https://api.example.com/v1/snapshot',
        pollSeconds: 120,
        modules: {
          weather: true,
          alerts: false,
          aqi: true,
          market: true,
          marketSymbols: ['VTI', 'QQQ'],
        },
      },
    });

    const { body, headers } = buildCloudSnapshotRequest(config);
    expect(body.include).toEqual(['weather', 'aqi', 'market']);
    expect(body.location.tempestStationId).toBe(81382);
    expect(body.market?.symbols).toEqual(['VTI', 'QQQ']);
    expect(headers['X-Tempest-Token']).toBe('pat-secret-123');
  });
});

describe('CloudSyncService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('caches snapshot, sends If-None-Match, handles 304, and marks stale on failure', async () => {
    const sampleSnapshot: CloudSnapshotResponse = {
      schemaVersion: 1,
      generatedAt: '2026-11-22T15:00:00.000Z',
      weather: {
        source: 'tempest',
        locationName: 'Santa Fe, NM',
        unit: 'fahrenheit',
        timezone: 'America/Denver',
        fetchedAt: '2026-11-22T15:00:00.000Z',
        stale: false,
        current: {
          temperature: 54,
          apparentTemperature: 52,
          humidity: 30,
          windSpeed: 6,
          weatherCode: 0,
          condition: 'Clear',
          isDay: true,
          uvIndex: 3,
        },
        hourly: [],
        daily: [],
      },
      alerts: [],
      aqi: {
        usAqi: 24,
        category: 'Good',
        fetchedAt: '2026-11-22T15:00:00.000Z',
      },
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(sampleSnapshot), {
          status: 200,
          headers: { ETag: 'W/"abc123"' },
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 304 }))
      .mockRejectedValueOnce(new Error('network down'));

    vi.stubGlobal('fetch', fetchMock);

    const service = new CloudSyncService('/tmp/homeboard-cloud-test-cache.json');
    const config = makeConfig({
      cloud: {
        enabled: true,
        endpointUrl: 'https://api.example.com/v1/snapshot',
        pollSeconds: 120,
        modules: {
          weather: true,
          alerts: true,
          aqi: true,
          market: false,
          marketSymbols: ['SPY'],
        },
      },
    });

    // 1. Initial 200 fetch
    const first = await service.refresh(config);
    expect(first?.weather?.current.temperature).toBe(54);
    expect(first?.aqi?.usAqi).toBe(24);

    // 2. Second fetch sends If-None-Match and keeps cached data on 304
    const second = await service.refresh(config);
    expect(second?.weather?.stale).toBe(false);
    const secondHeaders = fetchMock.mock.calls[1][1].headers as Record<string, string>;
    expect(secondHeaders['If-None-Match']).toBe('W/"abc123"');

    // 3. Third fetch fails and marks weather stale without dropping cache
    const third = await service.refresh(config);
    expect(third?.weather?.stale).toBe(true);
    expect(service.getSnapshot().error).toContain('network down');
  });
});
