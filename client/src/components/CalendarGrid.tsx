import type { CalendarEvent, DisplayConfig } from '../../../shared/types';
import {
  buildCalendarGrid,
  formatEventTime,
  getWeekdayHeaders,
} from '../utils/date';

interface CalendarGridProps {
  now: Date;
  timezone: string;
  display: DisplayConfig;
  eventsByDay: Map<string, CalendarEvent[]>;
}

const MAX_PILLS_PER_DAY = 4;

export function CalendarGrid({
  now,
  timezone,
  display,
  eventsByDay,
}: CalendarGridProps) {
  const { days, monthHeading, weekCount } = buildCalendarGrid(
    now,
    timezone,
    display.gridMode,
    display.weekStartsOn,
    eventsByDay
  );

  const weekdays = getWeekdayHeaders(display.weekStartsOn);

  return (
    <section className="calendar-panel" aria-label="Family Calendar">
      <div className="panel-header">
        <h2 className="panel-title">{monthHeading}</h2>
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

          return (
            <div
              key={day.dateKey}
              className={[
                'day-cell',
                day.isNextMonth ? 'day-cell-next-month' : '',
                day.isToday ? 'day-cell-today' : '',
                day.isPast ? 'day-cell-past' : '',
                !day.isCurrentMonth && display.gridMode === 'month'
                  ? 'day-cell-outside'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
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
                {day.isToday && <span className="today-tag">Today</span>}
              </div>

              <div className="day-events">
                {visibleEvents.map((ev) => (
                  <div
                    key={`${day.dateKey}-${ev.id}`}
                    className={`event-pill ${ev.allDay ? 'event-pill-allday' : ''}`}
                    style={
                      ev.allDay
                        ? {
                            backgroundColor: `${ev.color}2e`,
                            borderLeftColor: ev.color,
                          }
                        : {
                            borderLeftColor: ev.color,
                          }
                    }
                    title={ev.title}
                  >
                    {!ev.allDay && (
                      <span className="event-pill-time">
                        {formatEventTime(ev.start, timezone, display.clockFormat)}
                      </span>
                    )}
                    <span className="event-pill-title">{ev.title}</span>
                  </div>
                ))}
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
