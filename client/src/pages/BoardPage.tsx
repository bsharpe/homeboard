import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BoardPayload } from '../../../shared/types';
import { AgendaSidebar } from '../components/AgendaSidebar';
import { AmbientWeatherOverlay } from '../components/AmbientWeatherOverlay';
import { CalendarGrid } from '../components/CalendarGrid';
import { HeaderBar } from '../components/HeaderBar';
import {
  getSeason,
  getSkyPhase,
  getWeatherMood,
  resolveBoardTheme,
} from '../utils/atmosphere';
import { getHourInTimeZone, mapEventsByDay } from '../utils/date';

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

  // Keyboard shortcuts (S = settings, R = refresh)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 's' || e.key === 'S') {
        onOpenSettings();
      } else if (e.key === 'r' || e.key === 'R') {
        void handleManualRefresh();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onOpenSettings, handleManualRefresh]);

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
          usingDemoData={board.usingDemoData}
          offline={offline || Boolean(board.weather?.stale)}
          refreshing={refreshing}
          onRefresh={() => void handleManualRefresh()}
          onOpenSettings={onOpenSettings}
        />

        <main className="board-main">
          <CalendarGrid
            now={now}
            timezone={timezone}
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
            weather={board.weather}
          />
        </main>
      </div>
    </div>
  );
}
