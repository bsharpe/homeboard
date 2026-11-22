import type {
  CalendarEvent,
  CalendarSyncStatus,
  DailyForecastItem,
  DisplayConfig,
  WeatherData,
} from '../../../shared/types';
import {
  buildCalendarGrid,
  formatEventTime,
  getWeekdayHeaders,
} from '../utils/date';
import { getCalendarAbbrev, getContrastTextColor } from '../utils/calendarBadge';
import { dayHasCelebration, getEventDelight } from '../utils/eventDelight';
import { getHolidayForDateKey } from '../utils/holidays';
import { getMoonPhaseForDateKey } from '../utils/moon';
import { EventDelightIcon } from './EventDelightIcon';
import { HolidayAnimation } from './HolidayAnimation';
import { MoonPhaseIcon } from './MoonPhaseIcon';
import { WeatherIcon } from './WeatherIcon';

interface CalendarGridProps {
  now: Date;
  timezone: string;
  display: DisplayConfig;
  eventsByDay: Map<string, CalendarEvent[]>;
  calendarStatus: CalendarSyncStatus[];
  weather: WeatherData | null;
}

const MAX_PILLS_PER_DAY = 4;

export function CalendarGrid({
  now,
  timezone,
  display,
  eventsByDay,
  calendarStatus,
  weather,
}: CalendarGridProps) {
  const { days, monthHeading, weekCount } = buildCalendarGrid(
    now,
    timezone,
    display.gridMode,
    display.weekStartsOn,
    eventsByDay
  );

  const weekdays = getWeekdayHeaders(display.weekStartsOn);
  const activeCalendars = calendarStatus.filter((c) => c.enabled);
  const forecastByDay = new Map<string, DailyForecastItem>();
  if (display.calendarWeather && weather?.daily) {
    for (const item of weather.daily) {
      forecastByDay.set(item.date, item);
    }
  }

  const abbrevByCalendarId = new Map<string, string>();
  for (const cal of calendarStatus) {
    abbrevByCalendarId.set(cal.id, getCalendarAbbrev(cal.name, cal.abbreviation));
  }

  return (
    <section className="calendar-panel" aria-label="Family Calendar">
      <div className="panel-header calendar-panel-header">
        <div className="calendar-header-left">
          <h2 className="panel-title">{monthHeading}</h2>
          {activeCalendars.length > 0 && (
            <div className="calendar-legend">
              {activeCalendars.map((cal) => {
                const abbrev = getCalendarAbbrev(cal.name, cal.abbreviation);
                return (
                  <div
                    key={cal.id}
                    className={`legend-pill ${!cal.ok ? 'legend-pill-error' : ''}`}
                    title={cal.error ? `Sync error: ${cal.error}` : `${cal.eventCount} events`}
                  >
                    <span
                      className="legend-badge"
                      style={{
                        backgroundColor: cal.color,
                        color: getContrastTextColor(cal.color),
                      }}
                    >
                      {abbrev}
                    </span>
                    <span className="legend-name">{cal.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <span className="panel-subtitle">
          {display.gridMode === 'rolling-4w' ? '4-Week View' : 'Month View'}
        </span>
      </div>

      <div className="calendar-weekdays">
        {weekdays.map((day) => (
          <div key={day} className="weekday-label">
            {day}
          </div>
        ))}
      </div>

      <div
        className="calendar-grid"
        style={{ gridTemplateRows: `repeat(${weekCount}, minmax(0, 1fr))` }}
      >
        {days.map((day, idx) => {
          const showMonthPrefix = day.dayNumber === 1 || idx === 0;
          const visibleEvents = day.events.slice(0, MAX_PILLS_PER_DAY);
          const overflowCount = day.events.length - visibleEvents.length;
          const holiday = getHolidayForDateKey(day.dateKey);
          const moon = getMoonPhaseForDateKey(day.dateKey);
          const hasCelebration = dayHasCelebration(day.events);
          const dayForecast = forecastByDay.get(day.dateKey);

          return (
            <div
              key={day.dateKey}
              className={[
                'day-cell',
                day.isNextMonth ? 'day-cell-next-month' : '',
                holiday ? `day-cell-holiday day-cell-holiday-${holiday.id}` : '',
                hasCelebration && !holiday && !day.isPast ? 'day-cell-celebration' : '',
                day.isToday ? 'day-cell-today' : '',
                day.isPast ? 'day-cell-past' : '',
                !day.isCurrentMonth && display.gridMode === 'month'
                  ? 'day-cell-outside'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {holiday && <HolidayAnimation holiday={holiday.id} />}
              {hasCelebration && !holiday && !day.isPast && (
                <div className="day-sparkles" aria-hidden="true">
                  <span className="day-sparkle day-sparkle-1" />
                  <span className="day-sparkle day-sparkle-2" />
                  <span className="day-sparkle day-sparkle-3" />
                </div>
              )}

              <div className="day-cell-header">
                <span className={day.isToday ? 'day-num day-num-today' : 'day-num'}>
                  {showMonthPrefix && !day.isToday ? (
                    <>
                      <span className="day-month-tag">{day.monthShort}</span> {day.dayNumber}
                    </>
                  ) : (
                    day.dayNumber
                  )}
                </span>
                <div className="day-header-right">
                  {holiday && !day.isToday && (
                    <span className="day-holiday-tag">{holiday.label}</span>
                  )}
                  {dayForecast && !day.isToday && (
                    <span
                      className="day-weather-badge"
                      title={`${dayForecast.condition} · H ${dayForecast.tempMax}° / L ${dayForecast.tempMin}°${
                        dayForecast.precipitationProbability >= 15
                          ? ` · ${dayForecast.precipitationProbability}% precip`
                          : ''
                      }`}
                    >
                      <WeatherIcon code={dayForecast.weatherCode} isDay={true} size={13} />
                      <span className="day-weather-temp">{dayForecast.tempMax}°</span>
                    </span>
                  )}
                  {moon.majorPhase && (
                    <span className="day-moon-badge" title={moon.name}>
                      <MoonPhaseIcon phase={moon.phase} size={13} title={moon.name} />
                    </span>
                  )}
                  {day.isToday && <span className="today-tag">Today</span>}
                </div>
              </div>

              <div className="day-events">
                {visibleEvents.map((ev) => {
                  const delight = getEventDelight(ev.title);
                  const abbrev =
                    ev.calendarAbbrev?.trim() ||
                    abbrevByCalendarId.get(ev.calendarId) ||
                    getCalendarAbbrev(ev.calendarName);
                  return (
                    <div
                      key={`${day.dateKey}-${ev.id}`}
                      className={[
                        'event-pill',
                        ev.allDay ? 'event-pill-allday' : '',
                        delight?.isCelebration ? 'event-pill-celebration' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      style={
                        ev.allDay
                          ? {
                              backgroundColor: `${ev.color}24`,
                              borderLeftColor: ev.color,
                            }
                          : {
                              borderLeftColor: ev.color,
                            }
                      }
                      title={`${ev.calendarName}: ${ev.title}`}
                    >
                      <span
                        className="event-cal-badge"
                        style={{
                          backgroundColor: ev.color,
                          color: getContrastTextColor(ev.color),
                        }}
                        aria-label={ev.calendarName}
                      >
                        {abbrev}
                      </span>
                      {delight && <EventDelightIcon kind={delight.kind} size={11} />}
                      {!ev.allDay && (
                        <span className="event-pill-time">
                          {formatEventTime(ev.start, timezone, display.clockFormat)}
                        </span>
                      )}
                      <span className="event-pill-title">{ev.title}</span>
                    </div>
                  );
                })}
                {overflowCount > 0 && (
                  <div className="event-overflow">+{overflowCount} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
