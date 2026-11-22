import type { WeatherAlert, WeatherAlertSeverity } from '../../../shared/types.js';
import { CacheStore, roundCoord } from '../cache.js';

const NWS_TTL_SEC = 900; // 15 minutes

const SEVERITY_RANK: Record<WeatherAlertSeverity, number> = {
  Extreme: 0,
  Severe: 1,
  Moderate: 2,
  Minor: 3,
  Unknown: 4,
};

function normalizeSeverity(raw?: string): WeatherAlertSeverity {
  if (raw === 'Extreme' || raw === 'Severe' || raw === 'Moderate' || raw === 'Minor') {
    return raw;
  }
  return 'Unknown';
}

interface NwsAlertsResponse {
  features?: Array<{
    id?: string;
    properties?: {
      id?: string;
      event?: string;
      headline?: string;
      severity?: string;
      urgency?: string;
      onset?: string;
      effective?: string;
      expires?: string;
      ends?: string;
      areaDesc?: string;
      status?: string;
    };
  }>;
}

export async function resolveAlerts(
  lat: number,
  lon: number,
  cache: CacheStore,
  options?: { force?: boolean; fetchFn?: typeof fetch }
): Promise<WeatherAlert[]> {
  const fetchFn = options?.fetchFn ?? fetch;
  const cacheKey = `alerts:nws:${roundCoord(lat)},${roundCoord(lon)}`;

  if (!options?.force) {
    const cached = await cache.getJson<WeatherAlert[]>(cacheKey);
    if (cached) return cached;
  }

  const url = `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`;
  const res = await fetchFn(url, {
    headers: {
      Accept: 'application/geo+json',
      'User-Agent': 'HomeboardCloudAPI/1.0 (https://github.com/bsharpe/homeboard)',
    },
  });

  // Non-US coordinates return 400/404 from NWS; treat cleanly as no NWS alerts
  if (res.status === 400 || res.status === 404) {
    await cache.setJson(cacheKey, [], NWS_TTL_SEC);
    return [];
  }
  if (!res.ok) {
    throw new Error(`NWS Alerts returned HTTP ${res.status}`);
  }

  const raw = (await res.json()) as NwsAlertsResponse;
  const seen = new Set<string>();
  const alerts: WeatherAlert[] = [];

  for (const feature of raw.features ?? []) {
    const props = feature.properties;
    if (!props || props.status === 'Test') continue;
    const event = props.event?.trim();
    if (!event) continue;

    const id = props.id || feature.id || `${event}:${props.onset ?? props.effective ?? ''}`;
    if (seen.has(id)) continue;
    seen.add(id);

    alerts.push({
      id,
      event,
      headline: props.headline?.trim() || event,
      severity: normalizeSeverity(props.severity),
      urgency: props.urgency,
      startsAt: props.onset || props.effective,
      expiresAt: props.ends || props.expires,
      areaDesc: props.areaDesc,
    });
  }

  alerts.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  const topAlerts = alerts.slice(0, 5);
  await cache.setJson(cacheKey, topAlerts, NWS_TTL_SEC);
  return topAlerts;
}
