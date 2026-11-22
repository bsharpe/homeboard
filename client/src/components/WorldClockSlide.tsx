import { Moon, Sun } from 'lucide-react';
import type { WorldClockCity } from '../../../shared/types';
import { formatClock } from '../utils/date';

interface WorldClockSlideProps {
  now: Date;
  homeTimezone: string;
  clockFormat: '12h' | '24h';
  cities: WorldClockCity[];
}

function getCityTimeParts(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZoneName: 'short',
    }).formatToParts(date);

    const rawHour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const hour = rawHour === 24 ? 0 : rawHour;
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    const second = Number(parts.find((p) => p.type === 'second')?.value ?? '0');
    const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
    const month = parts.find((p) => p.type === 'month')?.value ?? '';
    const day = parts.find((p) => p.type === 'day')?.value ?? '';
    const tzAbbr = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';

    return {
      hour,
      minute,
      second,
      dateLabel: `${weekday}, ${month} ${day}`,
      tzAbbr,
      isDay: hour >= 6 && hour < 19,
    };
  } catch {
    return {
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
      dateLabel: '',
      tzAbbr: timeZone,
      isDay: true,
    };
  }
}

function getOffsetMinutes(date: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const y = Number(parts.find((p) => p.type === 'year')?.value ?? '1970');
    const m = Number(parts.find((p) => p.type === 'month')?.value ?? '1');
    const d = Number(parts.find((p) => p.type === 'day')?.value ?? '1');
    const rawH = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const h = rawH === 24 ? 0 : rawH;
    const min = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    const sec = Number(parts.find((p) => p.type === 'second')?.value ?? '0');
    const asUtc = Date.UTC(y, m - 1, d, h, min, sec);
    return Math.round((asUtc - date.getTime()) / 60_000);
  } catch {
    return 0;
  }
}

function formatRelativeOffset(diffMinutes: number): string {
  if (Math.abs(diffMinutes) < 1) return 'Home';
  const sign = diffMinutes > 0 ? '+' : '-';
  const abs = Math.abs(diffMinutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return mins === 0 ? `${sign}${hours}h` : `${sign}${hours}h ${mins}m`;
}

function AnalogClockFace({
  hour,
  minute,
  second,
  isDay,
}: {
  hour: number;
  minute: number;
  second: number;
  isDay: boolean;
}) {
  const hourAngle = ((hour % 12) + minute / 60) * 30;
  const minuteAngle = (minute + second / 60) * 6;
  const secondAngle = second * 6;

  return (
    <svg
      className={`analog-clock ${isDay ? 'analog-clock-day' : 'analog-clock-night'}`}
      viewBox="0 0 120 120"
      aria-hidden="true"
    >
      <circle cx="60" cy="60" r="56" className="clock-dial" />
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = i * 30;
        const isMajor = i % 3 === 0;
        return (
          <line
            key={i}
            x1="60"
            y1={isMajor ? 9 : 11}
            x2="60"
            y2={isMajor ? 18 : 15}
            transform={`rotate(${angle} 60 60)`}
            className={isMajor ? 'clock-tick-major' : 'clock-tick-minor'}
          />
        );
      })}
      <line
        x1="60"
        y1="60"
        x2="60"
        y2="29"
        transform={`rotate(${hourAngle} 60 60)`}
        className="clock-hand-hour"
      />
      <line
        x1="60"
        y1="60"
        x2="60"
        y2="18"
        transform={`rotate(${minuteAngle} 60 60)`}
        className="clock-hand-minute"
      />
      <line
        x1="60"
        y1="68"
        x2="60"
        y2="16"
        transform={`rotate(${secondAngle} 60 60)`}
        className="clock-hand-second"
      />
      <circle cx="60" cy="60" r="3.5" className="clock-center-dot" />
    </svg>
  );
}

export function WorldClockSlide({
  now,
  homeTimezone,
  clockFormat,
  cities,
}: WorldClockSlideProps) {
  const homeOffset = getOffsetMinutes(now, homeTimezone);

  return (
    <section className="slide-panel world-clock-slide" aria-label="World Clock">
      <div className="slide-header">
        <div className="slide-header-left">
          <h2 className="slide-title">World Clock</h2>
        </div>
        <span className="slide-subtitle">
          {cities.length} {cities.length === 1 ? 'city' : 'cities'}
        </span>
      </div>

      <div className="world-clock-grid">
        {cities.map((city) => {
          const parts = getCityTimeParts(now, city.timezone);
          const { time, period } = formatClock(now, city.timezone, clockFormat, false);
          const offsetDiff = getOffsetMinutes(now, city.timezone) - homeOffset;
          const relLabel = formatRelativeOffset(offsetDiff);

          return (
            <div
              key={city.id}
              className={`world-clock-card ${parts.isDay ? 'city-day' : 'city-night'}`}
            >
              <div className="world-clock-card-top">
                <div className="world-clock-city-meta">
                  <span className="world-clock-city-name">{city.name}</span>
                  {city.subtitle && (
                    <span className="world-clock-city-sub">{city.subtitle}</span>
                  )}
                </div>
                <span className="world-clock-offset-pill">
                  {parts.isDay ? <Sun size={13} /> : <Moon size={13} />}
                  {relLabel}
                </span>
              </div>

              <div className="world-clock-visual">
                <AnalogClockFace
                  hour={parts.hour}
                  minute={parts.minute}
                  second={parts.second}
                  isDay={parts.isDay}
                />
              </div>

              <div className="world-clock-digital">
                <span className="world-clock-time">{time}</span>
                {period && <span className="world-clock-period">{period}</span>}
              </div>

              <div className="world-clock-footer">
                <span>{parts.dateLabel}</span>
                <span className="world-clock-tz">{parts.tzAbbr}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
