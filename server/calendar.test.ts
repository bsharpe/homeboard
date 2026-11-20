import { describe, expect, it } from 'vitest';
import { parseIcsText } from './calendar.js';
import type { CalendarFeedConfig } from '../shared/types.js';

const FEED: CalendarFeedConfig = {
  id: 'family',
  name: 'Family',
  url: 'https://example.com/cal.ics',
  color: '#f59e0b',
  enabled: true,
};

describe('parseIcsText', () => {
  it('parses single timed, all-day, and weekly recurring events with EXDATE', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Homeboard//Test//EN',
      'BEGIN:VEVENT',
      'UID:ev-1',
      'SUMMARY:Soccer Practice',
      'DTSTART:20261120T230000Z',
      'DTEND:20261121T003000Z',
      'LOCATION:MRC Fields',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:ev-2',
      'SUMMARY:School Holiday',
      'DTSTART;VALUE=DATE:20261126',
      'DTEND;VALUE=DATE:20261128',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:ev-3',
      'SUMMARY:Piano Lesson',
      'DTSTART:20261118T220000Z',
      'DTEND:20261118T230000Z',
      'RRULE:FREQ=WEEKLY;COUNT=4',
      'EXDATE:20261125T220000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const start = new Date('2026-11-15T00:00:00Z');
    const end = new Date('2026-12-15T00:00:00Z');
    const events = parseIcsText(ics, FEED, start, end);

    const soccer = events.find((e) => e.title === 'Soccer Practice');
    expect(soccer).toBeDefined();
    expect(soccer?.allDay).toBe(false);
    expect(soccer?.location).toBe('MRC Fields');

    const holiday = events.find((e) => e.title === 'School Holiday');
    expect(holiday).toBeDefined();
    expect(holiday?.allDay).toBe(true);
    expect(holiday?.start).toBe('2026-11-26');
    expect(holiday?.end).toBe('2026-11-28');

    const piano = events.filter((e) => e.title === 'Piano Lesson');
    // 4 weekly occurrences minus 1 EXDATE = 3
    expect(piano).toHaveLength(3);
  });
});
