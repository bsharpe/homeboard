import { CloudRain, Droplets, RefreshCw, Settings, Sun, Wind, WifiOff, Zap } from 'lucide-react';
import type { DisplayConfig, WeatherData } from '../../../shared/types';
import { formatClock, formatHourlyLabel } from '../utils/date';
import { getMoonPhaseForDate } from '../utils/moon';
import { getSolarInfo, getUvBadgeInfo } from '../utils/solar';
import { DaylightArc } from './DaylightArc';
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
  const tempUnit = weather?.unit === 'celsius' ? '°C' : '°';
  const windUnit = weather?.unit === 'celsius' ? 'km/h' : 'mph';
  const todayForecast = weather?.daily[0];
  const tomorrowForecast = weather?.daily[1];
  const hourlyPreview = weather?.hourly.slice(0, 6) ?? [];
  const moon = getMoonPhaseForDate(now);
  const moonIlluminationPct = Math.round(moon.illumination * 100);
  const solar = getSolarInfo(now, timezone, todayForecast, tomorrowForecast, display.clockFormat);
  const uvBadge = weather
    ? getUvBadgeInfo(weather.current.uvIndex, weather.current.isDay)
    : null;

  return (
    <header className="board-header">
      <div className="header-clock">
        <div className="clock-row">
          <span className="clock-time">{time}</span>
          {period && <span className="clock-period">{period}</span>}
        </div>
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
                  <span
                    className="weather-location"
                    title={
                      weather.source === 'tempest'
                        ? 'Live Tempest Weather Station & hyperlocal forecast'
                        : 'Open-Meteo local forecast'
                    }
                  >
                    {weather.locationName}
                  </span>
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
                  <Wind size={13} /> {weather.current.windSpeed}
                  {weather.current.windGust !== undefined &&
                  weather.current.windGust >= weather.current.windSpeed + 4
                    ? ` (G ${weather.current.windGust})`
                    : ''}{' '}
                  {windUnit}
                </span>
                <span className="weather-meta-icon">
                  <Droplets size={13} /> {weather.current.humidity}%
                </span>
                {weather.current.precipToday !== undefined && weather.current.precipToday > 0 && (
                  <span
                    className="weather-meta-icon"
                    title="Rain accumulation today (Tempest station)"
                  >
                    <CloudRain size={13} />{' '}
                    {weather.unit === 'celsius'
                      ? `${weather.current.precipToday} mm`
                      : `${weather.current.precipToday}"`}
                  </span>
                )}
                {weather.current.lightningCount !== undefined &&
                  weather.current.lightningCount > 0 && (
                    <span
                      className="lightning-badge"
                      title={`${weather.current.lightningCount} lightning strike${
                        weather.current.lightningCount === 1 ? '' : 's'
                      } in the last hour`}
                    >
                      <Zap size={11} />{' '}
                      {weather.current.lightningLastDist !== undefined
                        ? `${weather.current.lightningLastDist} ${
                            weather.unit === 'celsius' ? 'km' : 'mi'
                          }`
                        : `${weather.current.lightningCount}`}
                    </span>
                  )}
                {uvBadge && (
                  <span
                    className={`uv-badge uv-badge-${uvBadge.tone}`}
                    title={`UV Index ${weather.current.uvIndex} (${uvBadge.label})`}
                  >
                    <Sun size={11} /> UV {uvBadge.value} {uvBadge.label}
                  </span>
                )}
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
        <div className="header-celestial">
          {solar && <DaylightArc solar={solar} />}
          <div
            className="header-moon"
            title={`${moon.name} · ${moonIlluminationPct}% illuminated`}
          >
            <div className="header-moon-icon">
              <MoonPhaseIcon phase={moon.phase} size={42} />
            </div>
            <div className="header-moon-text">
              <span className="header-moon-name">{moon.name}</span>
              <span className="header-moon-meta">{moonIlluminationPct}% lit</span>
            </div>
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
