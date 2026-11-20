import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../../../shared/types';
import { dayHasCelebration, getEventDelight } from './eventDelight';

function makeEvent(title: string): CalendarEvent {
  return {
    id: 'test-1',
    title,
    start: '2026-11-20T16:00:00Z',
    end: '2026-11-20T17:00:00Z',
    allDay: false,
    calendarId: 'fam',
    calendarName: 'Family',
    color: '#f59e0b',
  };
}

describe('eventDelight', () => {
  it('detects birthdays and holidays as celebrations', () => {
    expect(getEventDelight("Maya's Birthday Party")).toEqual({
      kind: 'birthday',
      isCelebration: true,
    });
    expect(getEventDelight('Thanksgiving Dinner')).toEqual({
      kind: 'holiday',
      isCelebration: true,
    });
    expect(dayHasCelebration([makeEvent('Soccer Practice')])).toBe(false);
    expect(dayHasCelebration([makeEvent('Soccer Practice'), makeEvent('Mom Birthday')])).toBe(true);
  });

  it('classifies everyday family events into contextual categories', () => {
    expect(getEventDelight('Soccer Practice')?.kind).toBe('sports');
    expect(getEventDelight('Dale Ball Trails Morning Hike')?.kind).toBe('outdoors');
    expect(getEventDelight('Piano Lesson')?.kind).toBe('music');
    expect(getEventDelight('Dentist Appointment')?.kind).toBe('health');
    expect(getEventDelight('School Spirit Day')?.kind).toBe('school');
    expect(getEventDelight('Family Dinner — Green Chile Enchiladas')?.kind).toBe('food');
    expect(getEventDelight('Flight to Denver')?.kind).toBe('travel');
    expect(getEventDelight('Random Misc Errand')).toBeNull();
  });
});
