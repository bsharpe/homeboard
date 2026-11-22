import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppConfig, BoardPayload, CalendarFeedConfig } from '../shared/types.js';
import { loadConfig, saveConfig } from './config.js';
import { CalendarService, fetchAndParseFeed } from './calendar.js';
import { CloudSyncService, testCloudEndpoint } from './cloud.js';
import { MarketService } from './market.js';
import {
  WeatherService,
  discoverTempestStations,
  fetchTempestBetterForecast,
  searchLocations,
} from './weather.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const app = express();
app.use(express.json({ limit: '1mb' }));

const weatherService = new WeatherService();
const calendarService = new CalendarService();
const marketService = new MarketService();
const cloudService = new CloudSyncService();

let currentConfig: AppConfig;
let weatherTimer: NodeJS.Timeout | null = null;
let calendarTimer: NodeJS.Timeout | null = null;
let marketTimer: NodeJS.Timeout | null = null;
let cloudTimer: NodeJS.Timeout | null = null;

const MARKET_REFRESH_MS = 5 * 60_000;

function isCloudActive(config: AppConfig): boolean {
  return Boolean(config.cloud?.enabled && config.cloud.endpointUrl.trim().length > 0);
}

function scheduleBackgroundSync(): void {
  if (weatherTimer) clearInterval(weatherTimer);
  if (calendarTimer) clearInterval(calendarTimer);
  if (marketTimer) clearInterval(marketTimer);
  if (cloudTimer) clearInterval(cloudTimer);

  calendarTimer = setInterval(() => {
    void calendarService.refreshAll(currentConfig.calendars);
  }, currentConfig.refresh.calendarMinutes * 60_000);

  if (isCloudActive(currentConfig)) {
    const pollMs = (currentConfig.cloud?.pollSeconds ?? 120) * 1000;
    cloudTimer = setInterval(() => {
      void cloudService.refresh(currentConfig);
    }, pollMs);
  } else {
    weatherTimer = setInterval(() => {
      void weatherService.refresh(currentConfig.weather);
    }, currentConfig.refresh.weatherMinutes * 60_000);

    marketTimer = setInterval(() => {
      void marketService.refresh();
    }, MARKET_REFRESH_MS);
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get('/api/board', (_req, res) => {
  const calSnap = calendarService.getSnapshot(
    currentConfig.calendars,
    currentConfig.display.demoMode,
    currentConfig.weather.timezone
  );

  const cloudActive = isCloudActive(currentConfig);
  const cloudSnap = cloudActive ? cloudService.getSnapshot() : null;
  const cloudModules = currentConfig.cloud?.modules;

  const weatherSnap = weatherService.getSnapshot();
  const marketSnap = marketService.getSnapshot();

  const weather = cloudActive
    ? cloudModules?.weather
      ? (cloudSnap?.data?.weather ?? null)
      : null
    : weatherSnap.data;

  const weatherError = cloudActive
    ? cloudSnap?.data?.errors?.weather ?? cloudSnap?.error
    : weatherSnap.error;

  const market = cloudActive
    ? cloudModules?.market
      ? (cloudSnap?.data?.market ?? null)
      : null
    : marketSnap.data;

  const weatherAlerts =
    cloudActive && cloudModules?.alerts ? (cloudSnap?.data?.alerts ?? []) : [];

  const airQuality =
    cloudActive && cloudModules?.aqi ? (cloudSnap?.data?.aqi ?? null) : null;

  const payload: BoardPayload = {
    serverTime: new Date().toISOString(),
    timezone: currentConfig.weather.timezone,
    location: {
      name: currentConfig.weather.name,
      latitude: currentConfig.weather.latitude,
      longitude: currentConfig.weather.longitude,
    },
    display: currentConfig.display,
    weather,
    weatherError,
    weatherAlerts,
    airQuality,
    market,
    events: calSnap.events,
    calendarStatus: calSnap.status,
    usingDemoData: calSnap.usingDemoData,
    lastCalendarSyncAt: calSnap.lastSyncAt,
    cloudEnabled: cloudActive,
    cloudError: cloudActive ? cloudSnap?.error : undefined,
  };

  res.json(payload);
});

app.get('/api/config', (_req, res) => {
  res.json(currentConfig);
});

app.put('/api/config', async (req, res) => {
  try {
    const incoming = req.body as AppConfig;
    const prevWeatherKey = JSON.stringify(currentConfig.weather);
    const prevCalendarsKey = JSON.stringify(currentConfig.calendars);
    const prevCloudKey = JSON.stringify(currentConfig.cloud);

    currentConfig = await saveConfig(incoming);
    scheduleBackgroundSync();

    const tasks: Promise<unknown>[] = [];
    if (isCloudActive(currentConfig)) {
      if (
        JSON.stringify(currentConfig.cloud) !== prevCloudKey ||
        JSON.stringify(currentConfig.weather) !== prevWeatherKey
      ) {
        tasks.push(cloudService.refresh(currentConfig, { force: true }));
      }
    } else {
      if (
        JSON.stringify(currentConfig.weather) !== prevWeatherKey ||
        JSON.stringify(currentConfig.cloud) !== prevCloudKey
      ) {
        tasks.push(weatherService.refresh(currentConfig.weather));
        tasks.push(marketService.refresh());
      }
    }
    if (JSON.stringify(currentConfig.calendars) !== prevCalendarsKey) {
      tasks.push(calendarService.refreshAll(currentConfig.calendars));
    }
    await Promise.all(tasks);

    res.json(currentConfig);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save config';
    res.status(400).json({ error: message });
  }
});

app.post('/api/refresh', async (_req, res) => {
  const tasks: Promise<unknown>[] = [calendarService.refreshAll(currentConfig.calendars)];
  if (isCloudActive(currentConfig)) {
    tasks.push(cloudService.refresh(currentConfig, { force: true }));
  } else {
    tasks.push(weatherService.refresh(currentConfig.weather));
    tasks.push(marketService.refresh());
  }
  await Promise.all(tasks);
  res.json({ ok: true, refreshedAt: new Date().toISOString() });
});

app.post('/api/cloud/test', async (req, res) => {
  const incoming = req.body as Partial<AppConfig> | undefined;
  const testConfig: AppConfig = {
    ...currentConfig,
    weather: { ...currentConfig.weather, ...(incoming?.weather ?? {}) },
    cloud: {
      ...(currentConfig.cloud ?? {
        enabled: true,
        endpointUrl: '',
        pollSeconds: 120,
        modules: {
          weather: true,
          alerts: true,
          aqi: true,
          market: true,
          marketSymbols: ['SPY', 'QQQ'],
        },
      }),
      ...(incoming?.cloud ?? {}),
      modules: {
        ...(currentConfig.cloud?.modules ?? {
          weather: true,
          alerts: true,
          aqi: true,
          market: true,
          marketSymbols: ['SPY', 'QQQ'],
        }),
        ...(incoming?.cloud?.modules ?? {}),
      },
    },
  };

  const result = await testCloudEndpoint(testConfig);
  res.status(result.ok ? 200 : 400).json(result);
});

app.post('/api/calendars/test', async (req, res) => {
  const { url, name } = req.body as { url?: string; name?: string };
  if (!url || typeof url !== 'string' || !url.trim()) {
    res.status(400).json({ ok: false, error: 'Calendar URL is required' });
    return;
  }

  const testFeed: CalendarFeedConfig = {
    id: 'test',
    name: name?.trim() || 'Test Feed',
    url: url.trim(),
    color: '#38bdf8',
    enabled: true,
  };

  try {
    const now = new Date();
    const start = new Date(now.getTime() - 14 * 86_400_000);
    const end = new Date(now.getTime() + 50 * 86_400_000);
    const events = await fetchAndParseFeed(testFeed, start, end);
    res.json({
      ok: true,
      eventCount: events.length,
      sampleTitles: events.slice(0, 3).map((e) => e.title),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to parse feed';
    res.status(400).json({ ok: false, error: message });
  }
});

app.get('/api/weather/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  try {
    const results = await searchLocations(q);
    res.json({ results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Search failed';
    res.status(502).json({ error: message });
  }
});

app.post('/api/weather/tempest/stations', async (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token || typeof token !== 'string' || !token.trim()) {
    res.status(400).json({ error: 'Tempest Personal Access Token is required' });
    return;
  }
  try {
    const stations = await discoverTempestStations(token);
    res.json({ stations });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load Tempest stations';
    res.status(400).json({ error: message });
  }
});

app.post('/api/weather/tempest/test', async (req, res) => {
  const { token, stationId, unit, name, timezone } = req.body as {
    token?: string;
    stationId?: number;
    unit?: 'fahrenheit' | 'celsius';
    name?: string;
    timezone?: string;
  };
  if (!token || typeof token !== 'string' || !token.trim()) {
    res.status(400).json({ ok: false, error: 'Tempest token is required' });
    return;
  }
  const parsedId = Number(stationId);
  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    res.status(400).json({ ok: false, error: 'Valid Tempest Station ID is required' });
    return;
  }
  try {
    const data = await fetchTempestBetterForecast(token, Math.round(parsedId), {
      name: name?.trim() || '',
      unit: unit === 'celsius' ? 'celsius' : 'fahrenheit',
      timezone: timezone || currentConfig.weather.timezone,
    });
    res.json({
      ok: true,
      locationName: data.locationName,
      temperature: data.current.temperature,
      condition: data.current.condition,
      dailyCount: data.daily.length,
      hourlyCount: data.hourly.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Tempest connection failed';
    res.status(400).json({ ok: false, error: message });
  }
});

// Serve built client in production (dist/client)
const clientDistCandidates = [
  path.resolve(__dirname, '../client'),      // when running from dist/server/index.js
  path.resolve(process.cwd(), 'dist/client'), // fallback
];
const clientDistDir = clientDistCandidates.find((dir) => fs.existsSync(path.join(dir, 'index.html')));

if (clientDistDir) {
  app.use(express.static(clientDistDir));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) {
      next();
      return;
    }
    res.sendFile(path.join(clientDistDir, 'index.html'));
  });
}

async function start(): Promise<void> {
  currentConfig = await loadConfig();
  await cloudService.loadFromDisk();
  scheduleBackgroundSync();

  // Start HTTP server immediately so kiosk doesn't hang waiting on external APIs
  app.listen(PORT, HOST, () => {
    console.log(`[homeboard] Listening on http://${HOST}:${PORT}`);
    console.log(`[homeboard] Location: ${currentConfig.weather.name} (${currentConfig.weather.timezone})`);
    if (isCloudActive(currentConfig)) {
      console.log(`[homeboard] Cloud Data Hub enabled: ${currentConfig.cloud?.endpointUrl}`);
    }
  });

  // Kick off initial background fetches
  const initialTasks: Promise<unknown>[] = [calendarService.refreshAll(currentConfig.calendars)];
  if (isCloudActive(currentConfig)) {
    initialTasks.push(cloudService.refresh(currentConfig));
  } else {
    initialTasks.push(weatherService.refresh(currentConfig.weather));
    initialTasks.push(marketService.refresh());
  }
  void Promise.all(initialTasks);
}

void start();
