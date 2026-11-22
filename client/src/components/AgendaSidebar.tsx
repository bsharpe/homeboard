import { Calendar, Droplets, MapPin, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { CalendarEvent, DisplayConfig, MarketData, WeatherData } from '../../../shared/types';
import {
  buildAgendaGroups,
  formatEventTimeRange,
  formatShortWeekday,
  getDateKeyInTimeZone,
  parseDateKey,
} from '../utils/date';
import { WeatherIcon } from './WeatherIcon';
import { getEventDelight } from '../utils/eventDelight';
import { EventDelightIcon } from './EventDelightIcon';

interface AgendaSidebarProps {
  now: Date;
  timezone: string;
  display: DisplayConfig;
  eventsByDay: Map<string, CalendarEvent[]>;
  weather: WeatherData | null;
  market: MarketData | null;
  showMarket?: boolean;
  showForecast?: boolean;
}

function formatMarketSessionLabel(tradingDate: string, todayKey: string, isOpen: boolean): string {
  if (isOpen) return 'Live';
  if (tradingDate === todayKey) return 'Close';
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
  }).format(parseDateKey(tradingDate));
  return `${weekday} close`;
}

export function AgendaSidebar({
  now,
  timezone,
  display,
  eventsByDay,
  weather,
  market,
  showMarket = true,
  showForecast = true,
}: AgendaSidebarProps) {
  const groups = buildAgendaGroups(now, timezone, display.agendaDays, eventsByDay);
  const todayKey = getDateKeyInTimeZone(now, timezone);

  const forecastDays = weather?.daily.slice(0, 5) ?? [];
  const weekMin = forecastDays.length
    ? Math.min(...forecastDays.map((d) => d.tempMin))
    : 0;
  const weekMax = forecastDays.length
    ? Math.max(...forecastDays.map((d) => d.tempMax))
    : 100;
  const tempSpan = Math.max(1, weekMax - weekMin);

  return (
    <aside className="sidebar-column">
      <section className="agenda-panel" aria-label="Upcoming Agenda">
        <div className="panel-header">
          <h2 className="panel-title">Upcoming</h2>
          <span className="panel-subtitle">Next {display.agendaDays} days</span>
        </div>

        <div className="agenda-list">
          {groups.length === 0 ? (
            <div className="agenda-empty">
              <Calendar size={28} strokeWidth={1.5} />
              <p>No upcoming events</p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.dateKey} className="agenda-day-group">
                <div className={`agenda-day-heading ${group.isToday ? 'agenda-day-today' : ''}`}>
                  <span>{group.label}</span>
                  <span className="agenda-day-date">{group.sublabel}</span>
                </div>

                {group.events.length === 0 ? (
                  <div className="agenda-none-today">Nothing remaining today</div>
                ) : (
                  <div className="agenda-items">
                    {group.events.map((ev) => {
                      const startMs = new Date(ev.start).getTime();
                      const endMs = new Date(ev.end).getTime();
                      const nowMs = now.getTime();
                      const isLive = !ev.allDay && startMs <= nowMs && endMs > nowMs;
                      const liveProgressPct =
                        isLive && endMs > startMs
                          ? Math.min(100, Math.max(0, ((nowMs - startMs) / (endMs - startMs)) * 100))
                          : 0;
                      const delight = getEventDelight(ev.title);

                      return (
                        <div
                          key={`${group.dateKey}-${ev.id}`}
                          className={[
                            'agenda-item',
                            isLive ? 'agenda-item-live' : '',
                            delight?.isCelebration ? 'agenda-item-celebration' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <span
                            className="agenda-color-bar"
                            style={{ backgroundColor: ev.color }}
                          />
                          <div className="agenda-item-body">
                            <div className="agenda-item-top">
                              <span className="agenda-item-title-wrap">
                                {delight && <EventDelightIcon kind={delight.kind} size={13} />}
                                <span className="agenda-item-title">{ev.title}</span>
                              </span>
                              {isLive && (
                                <span className="live-dot">
                                  <span className="live-beacon" aria-hidden="true" />
                                  Now
                                </span>
                              )}
                            </div>
                            <div className="agenda-item-meta">
                              <span className="agenda-item-time">
                                {formatEventTimeRange(ev, timezone, display.clockFormat)}
                              </span>
                              <span className="agenda-item-cal">{ev.calendarName}</span>
                              {ev.location && (
                                <span className="agenda-item-loc">
                                  <MapPin size={11} /> {ev.location}
                                </span>
                              )}
                            </div>
                          </div>
                          {isLive && (
                            <div className="agenda-live-progress" aria-hidden="true">
                              <div
                                className="agenda-live-progress-fill"
                                style={{ width: `${liveProgressPct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {showMarket && market && market.quotes.length > 0 && (
        <section className="market-panel" aria-label="Market Indices">
          <div className="market-grid">
            {market.quotes.map((quote) => {
              const direction =
                quote.changePercent > 0 ? 'up' : quote.changePercent < 0 ? 'down' : 'flat';
              const sign = quote.changePercent > 0 ? '+' : '';
              const pctText = `${sign}${quote.changePercent.toFixed(2)}%`;
              const sessionLabel = formatMarketSessionLabel(
                quote.tradingDate,
                todayKey,
                quote.isMarketOpen
              );

              return (
                <div
                  key={quote.symbol}
                  className={`market-tile market-tile-${direction}`}
                  title={`${quote.symbol}: $${quote.price.toFixed(2)} (prev close $${quote.previousClose.toFixed(2)}) · ${sessionLabel}`}
                >
                  <div className="market-tile-top">
                    <span className="market-symbol">{quote.symbol}</span>
                    <span className="market-session">
                      {quote.isMarketOpen && <span className="market-live-dot" aria-hidden="true" />}
                      {sessionLabel}
                    </span>
                  </div>
                  <div className="market-change-row">
                    {direction === 'up' ? (
                      <TrendingUp size={16} />
                    ) : direction === 'down' ? (
                      <TrendingDown size={16} />
                    ) : (
                      <Minus size={16} />
                    )}
                    <span className="market-change">{pctText}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {showForecast && forecastDays.length > 0 && (
        <section className="forecast-panel" aria-label="5-Day Weather Forecast">
          <div className="panel-header">
            <h2 className="panel-title">5-Day Forecast</h2>
            <span className="panel-subtitle">{weather?.locationName}</span>
          </div>

          <div className="forecast-rows">
            {forecastDays.map((day) => {
              const leftPct = ((day.tempMin - weekMin) / tempSpan) * 100;
              const widthPct = Math.max(8, ((day.tempMax - day.tempMin) / tempSpan) * 100);

              return (
                <div key={day.date} className="forecast-row">
                  <span className={`forecast-day ${day.date === todayKey ? 'forecast-day-today' : ''}`}>
                    {formatShortWeekday(day.date, todayKey)}
                  </span>

                  <div className="forecast-icon-col">
                    <WeatherIcon code={day.weatherCode} isDay={true} size={20} />
                    {day.precipitationProbability >= 15 ? (
                      <span className="forecast-precip">
                        <Droplets size={10} />
                        {day.precipitationProbability}%
                      </span>
                    ) : (
                      <span className="forecast-precip-empty" />
                    )}
                  </div>

                  <span className="forecast-low">{day.tempMin}°</span>
                  <div className="forecast-bar-track">
                    <div
                      className="forecast-bar-fill"
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                      }}
                    />
                  </div>
                  <span className="forecast-high">{day.tempMax}°</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </aside>
  );
}
