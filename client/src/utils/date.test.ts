import { describe, expect, it } from 'vitest';
import { buildCalendarGrid, mapEventsByDay } from './date';
import type { CalendarEvent } from '../../../shared/types';

describe('date grid & multi-day mapping', () => {
  it('expands multi-day all-day events across each covered day', () => {
    const events: CalendarEvent[] = [
      {
        id: 'holiday-1',
        title: 'Thanksgiving Break',
        start: '2026-11-26',
        end: '2026-11-29',
        allDay: true,
        calendarId: 'fam',
        calendarName: 'Family',
        color: '#f59e0b',
      },
    ];

    const byDay = mapEventsByDay(events, 'America/Denver');
    expect(byDay.get('2026-11-26')).toHaveLength(1);
    expect(byDay.get('2026-11-27')).toHaveLength(1);
    expect(byDay.get('2026-11-28')).toHaveLength(1);
    expect(byDay.get('2026-11-29')).toBeUndefined();
  });

  it('builds a 28-day rolling-4w grid and highlights today', () => {
    const now = new Date('2026-11-20T15:00:00Z'); // 8:00 AM MST in Santa Fe
    const byDay = new Map<string, CalendarEvent[]>();
    const grid = buildCalendarGrid(now, 'America/Denver', 'rolling-4w', 0, byDay);

    expect(grid.days).toHaveLength(28);
    expect(grid.weekCount).toBe(4);
    const todayCells = grid.days.filter((d) => d.isToday);
    expect(todayCells).toHaveLength(1);
    expect(todayCells[0].dateKey).toBe('2026-11-20');
  });
});
