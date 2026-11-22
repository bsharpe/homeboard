import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CloudSunRain,
  Globe,
  Pause,
  Play,
  TrendingUp,
} from 'lucide-react';
import type { BoardPayload, BoardSlideId, WorldClockCity } from '../../../shared/types';
import { AgendaSidebar } from '../components/AgendaSidebar';
import { AmbientWeatherOverlay } from '../components/AmbientWeatherOverlay';
import { CalendarGrid } from '../components/CalendarGrid';
import { ForecastRadarSlide } from '../components/ForecastRadarSlide';
import { HeaderBar } from '../components/HeaderBar';
import { StocksSlide } from '../components/StocksSlide';
import { WorldClockSlide } from '../components/WorldClockSlide';
import {
  getSeason,
  getSkyPhase,
  getWeatherMood,
  resolveBoardTheme,
} from '../utils/atmosphere';
import { getHourInTimeZone, mapEventsByDay } from '../utils/date';

const DEFAULT_SLIDES: BoardSlideId[] = [
  'calendar',
  'stocks',
  'world-clock',
  'forecast-radar',
];

const DEFAULT_WORLD_CLOCK_CITIES: WorldClockCity[] = [
  { id: 'santa-fe', name: 'Santa Fe', timezone: 'America/Denver', subtitle: 'New Mexico' },
  { id: 'memphis', name: 'Memphis', timezone: 'America/Chicago', subtitle: 'Tennessee' },
  { id: 'miami', name: 'Miami', timezone: 'America/New_York', subtitle: 'Florida' },
];

const SLIDE_META: Record<BoardSlideId, { label: string }> = {
  calendar: { label: 'Calendar' },
  stocks: { label: 'Stocks' },
  'world-clock': { label: 'World Clock' },
  'forecast-radar': { label: 'Forecast & Radar' },
};

interface BoardPageProps {
  onOpenSettings: () => void;
}

const POLL_INTERVAL_MS = 60_000;
const SHIFT_OFFSETS: Array<[number, number]> = [
  [0, 0],
  [2, 1],
  [1, 2],
  [-1, 1],
  [-2, 0],
  [-1, -1],
];

function isInNightWindow(hour: number, startHour: number, endHour: number): boolean {
  if (startHour === endHour) return false;
  if (startHour < endHour) {
    return hour >= startHour && hour < endHour;
  }
  return hour >= startHour || hour < endHour;
}

export function BoardPage({ onOpenSettings }: BoardPageProps) {
  const [board, setBoard] = useState<BoardPayload | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const [offline, setOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cursorHidden, setCursorHidden] = useState(false);
  const [shiftIndex, setShiftIndex] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0);
  const [rotationPaused, setRotationPaused] = useState(false);
  const cursorTimerRef = useRef<number | null>(null);

  const fetchBoard = useCallback(async () => {
    try {
      const res = await fetch('/api/board', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as BoardPayload;
      setBoard(data);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetch('/api/refresh', { method: 'POST' });
      await fetchBoard();
    } catch {
      setOffline(true);
    } finally {
      setRefreshing(false);
    }
  }, [fetchBoard]);

  // Initial load + periodic polling
  useEffect(() => {
    void fetchBoard();
    const id = window.setInterval(() => {
      void fetchBoard();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [fetchBoard]);

  // Live clock tick
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Burn-in shift every 30 minutes
  useEffect(() => {
    const id = window.setInterval(() => {
      setShiftIndex((prev) => (prev + 1) % SHIFT_OFFSETS.length);
    }, 30 * 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Lock viewport scrollbars while viewing the kiosk board (keep /settings scrollable)
  useEffect(() => {
    document.documentElement.classList.add('board-mode');
    document.body.classList.add('board-mode');
    return () => {
      document.documentElement.classList.remove('board-mode');
      document.body.classList.remove('board-mode');
    };
  }, []);

  // Auto-hide cursor on kiosk after 3s of mouse inactivity
  useEffect(() => {
    const resetCursor = () => {
      setCursorHidden(false);
      if (cursorTimerRef.current) window.clearTimeout(cursorTimerRef.current);
      cursorTimerRef.current = window.setTimeout(() => setCursorHidden(true), 3000);
    };

    resetCursor();
    window.addEventListener('mousemove', resetCursor);
    window.addEventListener('mousedown', resetCursor);
    return () => {
      window.removeEventListener('mousemove', resetCursor);
      window.removeEventListener('mousedown', resetCursor);
      if (cursorTimerRef.current) window.clearTimeout(cursorTimerRef.current);
    };
  }, []);

  const activeSlides = useMemo<BoardSlideId[]>(() => {
    if (!board) return DEFAULT_SLIDES;
    if (board.display.rotationEnabled === false) return ['calendar'];
    const configured =
      board.display.rotationSlides && board.display.rotationSlides.length > 0
        ? board.display.rotationSlides
        : DEFAULT_SLIDES;
    const filtered = configured.filter((slide) => {
      if (slide === 'stocks' && board.cloudEnabled && board.market === null) {
        return false;
      }
      return true;
    });
    return filtered.length > 0 ? filtered : ['calendar'];
  }, [board]);

  const safeSlideIndex = activeSlides.length > 0 ? slideIndex % activeSlides.length : 0;
  const activeSlide = activeSlides[safeSlideIndex] ?? 'calendar';
  const rotationEnabled =
    (board?.display.rotationEnabled ?? true) && activeSlides.length > 1;
  const rotationIntervalSec = board?.display.rotationIntervalSeconds ?? 25;

  // Auto-rotate slides below header
  useEffect(() => {
    if (!rotationEnabled || rotationPaused) return;
    const id = window.setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % activeSlides.length);
    }, rotationIntervalSec * 1000);
    return () => window.clearInterval(id);
  }, [rotationEnabled, rotationPaused, rotationIntervalSec, activeSlides.length]);

  // Keyboard shortcuts (S = settings, R = refresh, Left/Right = slide, Space = pause)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 's' || e.key === 'S') {
        onOpenSettings();
      } else if (e.key === 'r' || e.key === 'R') {
        void handleManualRefresh();
      } else if (e.key === 'ArrowRight' && activeSlides.length > 1) {
        setSlideIndex((prev) => (prev + 1) % activeSlides.length);
      } else if (e.key === 'ArrowLeft' && activeSlides.length > 1) {
        setSlideIndex((prev) => (prev - 1 + activeSlides.length) % activeSlides.length);
      } else if (e.key === ' ' && rotationEnabled) {
        e.preventDefault();
        setRotationPaused((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onOpenSettings, handleManualRefresh, activeSlides.length, rotationEnabled]);

  const timezone = board?.timezone ?? 'America/Denver';

  const eventsByDay = useMemo(
    () => mapEventsByDay(board?.events ?? [], timezone),
    [board?.events, timezone]
  );

  if (!board) {
    return (
      <div className="board-loading">
        <div className="loading-spinner" />
        <p>Starting Homeboard…</p>
      </div>
    );
  }

  const currentHour = getHourInTimeZone(now, timezone);
  const nightDimmed =
    board.display.nightDimEnabled &&
    isInNightWindow(
      currentHour,
      board.display.nightDimStartHour,
      board.display.nightDimEndHour
    );

  const [dx, dy] = board.display.burnInShift ? SHIFT_OFFSETS[shiftIndex] : [0, 0];
  const todayForecast = board.weather?.daily[0];
  const skyPhase = board.display.ambientWeather
    ? getSkyPhase(now, timezone, todayForecast?.sunrise, todayForecast?.sunset)
    : 'night';
  const weatherMood = board.display.ambientWeather
    ? getWeatherMood(board.weather?.current.weatherCode)
    : 'clear';
  const season = board.display.seasonalAccents ? getSeason(now, timezone) : undefined;
  const resolvedTheme = resolveBoardTheme(
    board.display.theme ?? 'dark',
    board.weather,
    now,
    timezone
  );

  return (
    <div
      className="board-viewport"
      data-theme={resolvedTheme}
      data-sky={board.display.ambientWeather ? skyPhase : 'static'}
      data-weather-mood={weatherMood}
      data-season={season}
    >
      <div
        className={`board-shell ${cursorHidden ? 'cursor-hidden' : ''}`}
        style={{
          opacity: nightDimmed ? board.display.nightDimOpacity : 1,
          transform: dx || dy ? `translate(${dx}px, ${dy}px)` : undefined,
        }}
      >
        {board.display.ambientWeather && (
          <AmbientWeatherOverlay
            mood={weatherMood}
            skyPhase={skyPhase}
            theme={resolvedTheme}
          />
        )}

        <HeaderBar
          now={now}
          timezone={timezone}
          display={board.display}
          weather={board.weather}
          airQuality={board.airQuality}
          usingDemoData={board.usingDemoData}
          offline={offline || Boolean(board.weather?.stale)}
          refreshing={refreshing}
          onRefresh={() => void handleManualRefresh()}
          onOpenSettings={onOpenSettings}
        />

        {board.weatherAlerts && board.weatherAlerts.length > 0 && (
          <div
            className={`weather-alert-banner weather-alert-${board.weatherAlerts[0].severity.toLowerCase()}`}
            role="status"
          >
            <AlertTriangle size={16} className="weather-alert-icon" />
            <span className="weather-alert-event">{board.weatherAlerts[0].event}</span>
            {board.weatherAlerts[0].headline &&
              board.weatherAlerts[0].headline !== board.weatherAlerts[0].event && (
                <span className="weather-alert-headline">
                  — {board.weatherAlerts[0].headline}
                </span>
              )}
            {board.weatherAlerts.length > 1 && (
              <span className="weather-alert-more">
                +{board.weatherAlerts.length - 1} more
              </span>
            )}
          </div>
        )}

        <div className="board-stage" key={activeSlide}>
          {activeSlide === 'calendar' && (
            <main className="board-main">
              <CalendarGrid
                now={now}
                timezone={timezone}
                latitude={board.location?.latitude}
                display={board.display}
                eventsByDay={eventsByDay}
                calendarStatus={board.calendarStatus}
                weather={board.weather}
              />

              <AgendaSidebar
                now={now}
                timezone={timezone}
                display={board.display}
                eventsByDay={eventsByDay}
                calendarStatus={board.calendarStatus}
                weather={board.weather}
                market={board.market}
                showMarket={!activeSlides.includes('stocks')}
                showForecast={!activeSlides.includes('forecast-radar')}
              />
            </main>
          )}

          {activeSlide === 'stocks' && (
            <StocksSlide now={now} timezone={timezone} market={board.market} />
          )}

          {activeSlide === 'world-clock' && (
            <WorldClockSlide
              now={now}
              homeTimezone={timezone}
              clockFormat={board.display.clockFormat}
              cities={
                board.display.worldClockCities && board.display.worldClockCities.length > 0
                  ? board.display.worldClockCities
                  : DEFAULT_WORLD_CLOCK_CITIES
              }
            />
          )}

          {activeSlide === 'forecast-radar' && (
            <ForecastRadarSlide
              now={now}
              timezone={timezone}
              theme={resolvedTheme}
              location={
                board.location ?? {
                  name: board.weather?.locationName ?? 'Santa Fe, NM',
                  latitude: 35.687,
                  longitude: -105.9378,
                }
              }
              weather={board.weather}
            />
          )}
        </div>

        {activeSlides.length > 1 && (
          <nav className="slide-switcher" aria-label="Board Views">
            <div className="slide-pills">
              {activeSlides.map((slide, idx) => {
                const isActive = idx === safeSlideIndex;
                return (
                  <button
                    key={slide}
                    type="button"
                    className={`slide-pill ${isActive ? 'slide-pill-active' : ''}`}
                    onClick={() => setSlideIndex(idx)}
                  >
                    {slide === 'calendar' && <Calendar size={12} />}
                    {slide === 'stocks' && <TrendingUp size={12} />}
                    {slide === 'world-clock' && <Globe size={12} />}
                    {slide === 'forecast-radar' && <CloudSunRain size={12} />}
                    <span>{SLIDE_META[slide].label}</span>
                    {isActive && rotationEnabled && !rotationPaused && (
                      <span
                        key={`${slide}-${safeSlideIndex}`}
                        className="slide-pill-progress"
                        style={{ animationDuration: `${rotationIntervalSec}s` }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="slide-pause-btn"
              onClick={() => setRotationPaused((p) => !p)}
              title={rotationPaused ? 'Resume rotation (Space)' : 'Pause rotation (Space)'}
              aria-label={rotationPaused ? 'Resume rotation' : 'Pause rotation'}
            >
              {rotationPaused ? <Play size={12} /> : <Pause size={12} />}
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
