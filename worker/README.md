# Homeboard Cloud API (Cloudflare Worker)

Multi-family, module-driven data hub for Homeboard. Each Raspberry Pi tells `POST /v1/snapshot` which modules it wants (`weather`, `alerts`, `aqi`, `market`), and the Worker resolves only those modules with per-module edge caching.

## Endpoints

- `GET /health` — Health check (`{ ok: true, service: "homeboard-cloud", schemaVersion: 1 }`)
- `POST /v1/snapshot` — Unified data snapshot endpoint:
  - **Weather**: Automatically prefers Tempest when `X-Tempest-Token` + `location.tempestStationId` (or Worker secrets) are present, and falls back to Open-Meteo if absent or unreachable. Tempest PATs are never logged or stored in cache.
  - **Alerts**: Active NWS weather alerts sorted by severity (US locations).
  - **AQI**: Current US AQI + PM2.5/PM10/Ozone via Open-Meteo Air Quality.
  - **Market**: Configurable symbols per family with shared per-symbol edge caching.
  - Supports `ETag` / `If-None-Match` (`304 Not Modified`).

## Local Development & Deployment

```bash
cd worker
npm install
npm run dev       # http://localhost:8787
npm run deploy    # Deploys to Cloudflare Workers
```

### Optional Secrets & KV Cache

```bash
# Create KV namespace for cross-isolate edge caching (paste ID into wrangler.toml)
npx wrangler kv namespace create CACHE

# Optional Bearer API key(s) — comma-separated for multiple families
npx wrangler secret put API_KEY

# Optional default Tempest station (if you don't want to store a PAT on your Pi)
npx wrangler secret put TEMPEST_TOKEN
npx wrangler secret put TEMPEST_STATION_ID
```
