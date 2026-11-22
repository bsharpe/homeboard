import { useEffect, useMemo, useState } from 'react';
import { Droplets, Radio, Sunrise, Sunset } from 'lucide-react';
import type { WeatherData } from '../../../shared/types';
import { formatShortWeekday, getDateKeyInTimeZone } from '../utils/date';
import { WeatherIcon } from './WeatherIcon';

interface ForecastRadarSlideProps {
  now: Date;
  timezone: string;
  theme: 'dark' | 'light';
  location: {
    name: string;
    latitude: number;
    longitude: number;
  };
  weather: WeatherData | null;
}

interface RadarFrame {
  time: number;
  path: string;
}

interface RainViewerResponse {
  host?: string;
  radar?: {
    past?: RadarFrame[];
    nowcast?: RadarFrame[];
  };
}

const RADAR_ZOOM = 7;
const TILE_SIZE = 256;
const GRID_COLS = 5;
const GRID_ROWS = 3;

function latLonToTileFloat(lat: number, lon: number, zoom: number) {
  const n = 2 ** zoom;
  const x = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y, n };
}

function formatLocalTimeFromIso(iso: string, clockFormat: '12h' | '24h' = '12h'): string {
  if (!iso || iso.length < 16) return '';
  const hour = Number(iso.slice(11, 13));
  const minute = iso.slice(14, 16);
  if (Number.isNaN(hour)) return '';
  if (clockFormat === '24h') return `${String(hour).padStart(2, '0')}:${minute}`;
  const period = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${minute} ${period}`;
}

export function ForecastRadarSlide({
  now,
  timezone,
  theme,
  location,
  weather,
}: ForecastRadarSlideProps) {
  const [radarHost, setRadarHost] = useState('https://tilecache.rainviewer.com');
  const [frames, setFrames] = useState<RadarFrame[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [radarError, setRadarError] = useState(false);

  // Fetch RainViewer public radar frames every 10 minutes
  useEffect(() => {
    let cancelled = false;

    const loadRadarFrames = async () => {
      try {
        const res = await fetch('https://api.rainviewer.com/public/weather-maps.json', {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as RainViewerResponse;
        if (cancelled) return;

        const past = data.radar?.past ?? [];
        const recent = past.slice(-6);
        if (data.host) setRadarHost(data.host);
        setFrames(recent);
        setFrameIndex(Math.max(0, recent.length - 1));
        setRadarError(false);
      } catch {
        if (!cancelled) setRadarError(true);
      }
    };

    void loadRadarFrames();
    const id = window.setInterval(() => void loadRadarFrames(), 10 * 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  // Animate radar frames smoothly
  useEffect(() => {
    if (frames.length <= 1) return;
    const id = window.setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % frames.length);
    }, 900);
    return () => window.clearInterval(id);
  }, [frames.length]);

  const tileGrid = useMemo(() => {
    const { x, y, n } = latLonToTileFloat(location.latitude, location.longitude, RADAR_ZOOM);
    const centerTileX = Math.floor(x);
    const centerTileY = Math.floor(y);
    const halfCols = Math.floor(GRID_COLS / 2);
    const halfRows = Math.floor(GRID_ROWS / 2);

    // Exact pixel offset of the home coordinate within the 5x3 tile canvas
    const pinPxX = (x - (centerTileX - halfCols)) * TILE_SIZE;
    const pinPxY = (y - (centerTileY - halfRows)) * TILE_SIZE;
    const canvasWidth = GRID_COLS * TILE_SIZE;
    const canvasHeight = GRID_ROWS * TILE_SIZE;

    const tiles: Array<{ key: string; tx: number; ty: number; col: number; row: number }> = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const rawTx = centerTileX - halfCols + col;
        const tx = ((rawTx % n) + n) % n;
        const ty = centerTileY - halfRows + row;
        if (ty >= 0 && ty < n) {
          tiles.push({ key: `${tx}-${ty}`, tx, ty, col, row });
        }
      }
    }

    return {
      tiles,
      canvasWidth,
      canvasHeight,
      offsetX: canvasWidth / 2 - pinPxX,
      offsetY: canvasHeight / 2 - pinPxY,
    };
  }, [location.latitude, location.longitude]);

  const todayKey = getDateKeyInTimeZone(now, timezone);
  const forecastDays = weather?.daily.slice(0, 5) ?? [];
  const weekMin = forecastDays.length ? Math.min(...forecastDays.map((d) => d.tempMin)) : 0;
  const weekMax = forecastDays.length ? Math.max(...forecastDays.map((d) => d.tempMax)) : 100;
  const tempSpan = Math.max(1, weekMax - weekMin);
  const todayForecast = forecastDays[0];

  const activeFrame = frames[frameIndex];
  const frameTimeLabel = activeFrame
    ? new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(activeFrame.time * 1000))
    : null;

  const esriBaseLayer =
    theme === 'light' ? 'Canvas/World_Light_Gray_Base' : 'Canvas/World_Dark_Gray_Base';
  const esriRefLayer =
    theme === 'light' ? 'Canvas/World_Light_Gray_Reference' : 'Canvas/World_Dark_Gray_Reference';

  return (
    <section className="forecast-radar-slide" aria-label="5-Day Forecast and Live Radar">
      <div className="slide-panel forecast-expanded-panel">
        <div className="slide-header">
          <h2 className="slide-title">5-Day Forecast</h2>
          <span className="slide-subtitle">{weather?.locationName ?? location.name}</span>
        </div>

        <div className="forecast-expanded-rows">
          {forecastDays.map((day) => {
            const leftPct = ((day.tempMin - weekMin) / tempSpan) * 100;
            const widthPct = Math.max(10, ((day.tempMax - day.tempMin) / tempSpan) * 100);
            const isToday = day.date === todayKey;

            return (
              <div
                key={day.date}
                className={`forecast-exp-row ${isToday ? 'forecast-exp-today' : ''}`}
              >
                <div className="forecast-exp-day">
                  <span className="forecast-exp-weekday">
                    {formatShortWeekday(day.date, todayKey)}
                  </span>
                  <span className="forecast-exp-condition">{day.condition}</span>
                </div>

                <div className="forecast-exp-icon">
                  <WeatherIcon code={day.weatherCode} isDay={true} size={32} />
                  {day.precipitationProbability >= 10 ? (
                    <span className="forecast-precip">
                      <Droplets size={11} />
                      {day.precipitationProbability}%
                    </span>
                  ) : (
                    <span className="forecast-precip-empty" />
                  )}
                </div>

                <span className="forecast-exp-low">{day.tempMin}°</span>
                <div className="forecast-bar-track forecast-bar-track-lg">
                  <div
                    className="forecast-bar-fill"
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  />
                </div>
                <span className="forecast-exp-high">{day.tempMax}°</span>
              </div>
            );
          })}
        </div>

        {todayForecast && (todayForecast.sunrise || todayForecast.sunset) && (
          <div className="forecast-sun-footer">
            {todayForecast.sunrise && (
              <span className="forecast-sun-item">
                <Sunrise size={15} /> Sunrise {formatLocalTimeFromIso(todayForecast.sunrise)}
              </span>
            )}
            {todayForecast.sunset && (
              <span className="forecast-sun-item">
                <Sunset size={15} /> Sunset {formatLocalTimeFromIso(todayForecast.sunset)}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="slide-panel radar-panel">
        <div className="radar-header-overlay">
          <span className="radar-pill">
            <Radio size={13} className="radar-live-icon" />
            Live Radar · {weather?.locationName ?? location.name}
          </span>
          {frameTimeLabel && !radarError && (
            <span className="radar-time-pill">{frameTimeLabel}</span>
          )}
          {radarError && <span className="radar-time-pill">Radar feed unavailable</span>}
        </div>

        <div className="radar-viewport">
          <div
            className="radar-canvas"
            style={{
              width: `${tileGrid.canvasWidth}px`,
              height: `${tileGrid.canvasHeight}px`,
              transform: `translate(calc(-50% + ${tileGrid.offsetX}px), calc(-50% + ${tileGrid.offsetY}px))`,
            }}
          >
            {tileGrid.tiles.map((tile) => {
              const baseUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/${esriBaseLayer}/MapServer/tile/${RADAR_ZOOM}/${tile.ty}/${tile.tx}`;
              const refUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/${esriRefLayer}/MapServer/tile/${RADAR_ZOOM}/${tile.ty}/${tile.tx}`;
              const radarUrl = activeFrame
                ? `${radarHost}${activeFrame.path}/256/${RADAR_ZOOM}/${tile.tx}/${tile.ty}/2/1_1.png`
                : null;

              return (
                <div
                  key={tile.key}
                  className="radar-tile-cell"
                  style={{
                    left: `${tile.col * TILE_SIZE}px`,
                    top: `${tile.row * TILE_SIZE}px`,
                    width: `${TILE_SIZE}px`,
                    height: `${TILE_SIZE}px`,
                  }}
                >
                  <img src={baseUrl} alt="" className="radar-base-tile" draggable={false} />
                  {radarUrl && (
                    <img src={radarUrl} alt="" className="radar-overlay-tile" draggable={false} />
                  )}
                  <img src={refUrl} alt="" className="radar-base-tile" draggable={false} />
                </div>
              );
            })}
          </div>

          <div className="radar-home-pin" title={location.name}>
            <span className="radar-home-ring" />
            <span className="radar-home-dot" />
          </div>
        </div>
      </div>
    </section>
  );
}
