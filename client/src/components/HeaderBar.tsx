import { Droplets, RefreshCw, Settings, Wind, WifiOff } from 'lucide-react';
import type { DisplayConfig, WeatherData } from '../../../shared/types';
import { formatClock, formatFullDate, formatHourlyLabel } from '../utils/date';
import { getMoonPhaseForDate } from '../utils/moon';
import { MoonPhaseIcon } from './MoonPhaseIcon';
import { WeatherIcon } from './WeatherIcon';

interface HeaderBarProps {
  now: Date;
  timezone: string;
  display: DisplayConfig;
  weather: WeatherData | null;
  usingDemoData: boolean;
  offline: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onOpenSettings: () => void;
}

export function HeaderBar({
  now,
  timezone,
  display,
  weather,
  usingDemoData,
  offline,
  refreshing,
  onRefresh,
  onOpenSettings,
}: HeaderBarProps) {
  const { time, period } = formatClock(now, timezone, display.clockFormat, display.showSeconds);
  const fullDate = formatFullDate(now, timezone);
  const tempUnit = weather?.unit === 'celsius' ? '°C' : '°';
  const windUnit = weather?.unit === 'celsius' ? 'km/h' : 'mph';
  const todayForecast = weather?.daily[0];
  const hourlyPreview = weather?.hourly.slice(0, 6) ?? [];
  const moon = getMoonPhaseForDate(now);
  const moonIlluminationPct = Math.round(moon.illumination * 100);

  return (
    <header className="board-header">
      <div className="header-clock">
        <div className="clock-row">
          <span className="clock-time">{time}</span>
          {period && <span className="clock-period">{period}</span>}
        </div>
        <div className="clock-date">{fullDate}</div>
      </div>

      {weather ? (
        <div className="header-weather">
          <div className="weather-current">
            <div className="weather-current-icon">
              <WeatherIcon
                code={weather.current.weatherCode}
                isDay={weather.current.isDay}
                size={46}
              />
            </div>
            <div className="weather-current-main">
              <div className="weather-temp-row">
                <span className="weather-temp">
                  {weather.current.temperature}
                  {tempUnit}
                </span>
                <div className="weather-location-stack">
                  <span className="weather-location">{weather.locationName}</span>
                  <span className="weather-condition">{weather.current.condition}</span>
                </div>
              </div>
              <div className="weather-meta">
                <span>Feels {weather.current.apparentTemperature}°</span>
                {todayForecast && (
                  <span>
                    H {todayForecast.tempMax}° · L {todayForecast.tempMin}°
                  </span>
                )}
                <span className="weather-meta-icon">
                  <Wind size={13} /> {weather.current.windSpeed} {windUnit}
                </span>
                <span className="weather-meta-icon">
                  <Droplets size={13} /> {weather.current.humidity}%
                </span>
              </div>
            </div>
          </div>

          {display.showHourlyWeather && hourlyPreview.length > 0 && (
            <div className="weather-hourly-strip">
              {hourlyPreview.map((slot) => (
                <div key={slot.time} className="hourly-slot">
                  <span className="hourly-time">
                    {formatHourlyLabel(slot.time, display.clockFormat)}
                  </span>
                  <WeatherIcon code={slot.weatherCode} isDay={slot.isDay} size={20} />
                  <span className="hourly-temp">{slot.temperature}°</span>
                  {slot.precipitationProbability >= 15 ? (
                    <span className="hourly-precip">{slot.precipitationProbability}%</span>
                  ) : (
                    <span className="hourly-precip-spacer" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="header-weather header-weather-loading">
          <span>Loading weather for Santa Fe, NM…</span>
        </div>
      )}

      <div className="header-right">
        <div
          className="header-moon"
          title={`${moon.name} · ${moonIlluminationPct}% illuminated`}
        >
          <div className="header-moon-icon">
            <MoonPhaseIcon phase={moon.phase} size={46} />
          </div>
          <div className="header-moon-text">
            <span className="header-moon-name">{moon.name}</span>
            <span className="header-moon-meta">{moonIlluminationPct}% illuminated</span>
          </div>
        </div>

        {(usingDemoData || offline) && (
          <div className="header-status-badges">
            {usingDemoData && <span className="demo-badge">Demo</span>}
            {offline && (
              <span className="offline-badge" title="Connection interrupted — showing cached data">
                <WifiOff size={13} /> Offline
              </span>
            )}
          </div>
        )}

        <div className="header-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={onRefresh}
            title="Refresh calendars & weather (R)"
            aria-label="Refresh"
          >
            <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onOpenSettings}
            title="Settings (S)"
            aria-label="Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
