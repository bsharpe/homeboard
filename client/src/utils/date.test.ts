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

    const nextMonthDays = grid.days.filter((d) => d.isNextMonth);
    expect(nextMonthDays[0].dateKey).toBe('2026-12-01');
    expect(nextMonthDays).toHaveLength(12);
    expect(grid.days.find((d) => d.dateKey === '2026-11-30')?.isNextMonth).toBe(false);
  });

  it('marks next-month days accurately across year boundaries and ignores prior month', () => {
    const byDay = new Map<string, CalendarEvent[]>();

    // Early in month: leading days from previous month should not be marked isNextMonth
    const earlyDec = new Date('2026-12-02T15:00:00Z');
    const earlyGrid = buildCalendarGrid(earlyDec, 'America/Denver', 'rolling-4w', 0, byDay);
    expect(earlyGrid.days.find((d) => d.dateKey === '2026-11-29')?.isNextMonth).toBe(false);
    expect(earlyGrid.days.find((d) => d.dateKey === '2026-11-30')?.isNextMonth).toBe(false);
    expect(earlyGrid.days.every((d) => !d.isNextMonth)).toBe(true);

    // Late December: January days in the following year should be marked isNextMonth
    const lateDec = new Date('2026-12-28T15:00:00Z');
    const lateGrid = buildCalendarGrid(lateDec, 'America/Denver', 'rolling-4w', 0, byDay);
    expect(lateGrid.days.find((d) => d.dateKey === '2026-12-31')?.isNextMonth).toBe(false);
    expect(lateGrid.days.find((d) => d.dateKey === '2027-01-01')?.isNextMonth).toBe(true);
    expect(lateGrid.days.find((d) => d.dateKey === '2027-01-23')?.isNextMonth).toBe(true);
  });
});
