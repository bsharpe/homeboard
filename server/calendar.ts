import ical, { type VEvent } from 'node-ical';
import type {
  CalendarEvent,
  CalendarFeedConfig,
  CalendarSyncStatus,
} from '../shared/types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateOnlyUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function toDateOnlyLocal(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${day}`;
}

function isAllDayEvent(ev: VEvent): boolean {
  const start = ev.start as Date & { dateOnly?: boolean };
  if (ev.datetype === 'date' || start?.dateOnly === true) {
    return true;
  }
  if (ev.start && ev.end) {
    const diff = ev.end.getTime() - ev.start.getTime();
    const startsMidnightUTC =
      ev.start.getUTCHours() === 0 &&
      ev.start.getUTCMinutes() === 0 &&
      ev.start.getUTCSeconds() === 0;
    if (startsMidnightUTC && diff >= DAY_MS && diff % DAY_MS === 0) {
      return true;
    }
  }
  return false;
}

function extractText(val: unknown): string | undefined {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (val && typeof val === 'object' && 'val' in val && typeof (val as { val: unknown }).val === 'string') {
    const trimmed = (val as { val: string }).val.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

export function parseIcsText(
  icsText: string,
  feed: CalendarFeedConfig,
  windowStart: Date,
  windowEnd: Date
): CalendarEvent[] {
  const parsed = ical.sync.parseICS(icsText);
  const results: CalendarEvent[] = [];

  for (const key of Object.keys(parsed)) {
    const item = parsed[key];
    if (!item || item.type !== 'VEVENT') continue;
    const ev = item as VEvent;
    if (!ev.start) continue;

    const title = extractText(ev.summary) ?? '(No title)';
    const location = extractText(ev.location);
    const description = extractText(ev.description);
    const allDay = isAllDayEvent(ev);

    const baseDurationMs = ev.end
      ? Math.max(ev.end.getTime() - ev.start.getTime(), allDay ? DAY_MS : 30 * 60 * 1000)
      : allDay
        ? DAY_MS
        : 60 * 60 * 1000;

    if (ev.rrule) {
      const dates = ev.rrule.between(
        new Date(windowStart.getTime() - baseDurationMs),
        windowEnd,
        true
      );

      for (const occurrenceStart of dates) {
        const dateKey = toDateOnlyUTC(occurrenceStart);

        // Check EXDATE exclusions
        if (ev.exdate) {
          const isExcluded = Object.values(ev.exdate).some((ex) => {
            if (!(ex instanceof Date)) return false;
            return (
              Math.abs(ex.getTime() - occurrenceStart.getTime()) < 60_000 ||
              toDateOnlyUTC(ex) === dateKey
            );
          });
          if (isExcluded) continue;
        }

        // Check if an overridden recurrence exists for this date
        const override = ev.recurrences?.[dateKey] as VEvent | undefined;
        const activeEv = override ?? ev;
        const actualStart = override?.start ?? occurrenceStart;
        const actualEnd = override?.end ?? new Date(actualStart.getTime() + baseDurationMs);

        if (actualEnd <= windowStart || actualStart >= windowEnd) continue;

        results.push({
          id: `${feed.id}:${ev.uid ?? key}:${actualStart.toISOString()}`,
          title: extractText(activeEv.summary) ?? title,
          start: allDay ? toDateOnlyUTC(actualStart) : actualStart.toISOString(),
          end: allDay ? toDateOnlyUTC(actualEnd) : actualEnd.toISOString(),
          allDay,
          location: extractText(activeEv.location) ?? location,
          description: extractText(activeEv.description) ?? description,
          calendarId: feed.id,
          calendarName: feed.name,
          color: feed.color,
        });
      }
    } else {
      const start = ev.start;
      const end = ev.end ?? new Date(start.getTime() + baseDurationMs);

      if (end <= windowStart || start >= windowEnd) continue;

      results.push({
        id: `${feed.id}:${ev.uid ?? key}:${start.toISOString()}`,
        title,
        start: allDay ? toDateOnlyUTC(start) : start.toISOString(),
        end: allDay ? toDateOnlyUTC(end) : end.toISOString(),
        allDay,
        location,
        description,
        calendarId: feed.id,
        calendarName: feed.name,
        color: feed.color,
      });
    }
  }

  return results;
}

function normalizeFeedUrl(url: string): string {
  // Support webcal:// URLs commonly copied from Apple iCloud
  return url.trim().replace(/^webcal:\/\//i, 'https://');
}

export async function fetchAndParseFeed(
  feed: CalendarFeedConfig,
  windowStart: Date,
  windowEnd: Date
): Promise<CalendarEvent[]> {
  const url = normalizeFeedUrl(feed.url);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: {
      'User-Agent': 'Homeboard/1.0 (RaspberryPi Family Calendar)',
      Accept: 'text/calendar, text/plain, */*',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  if (!text.includes('BEGIN:VCALENDAR')) {
    throw new Error('Response does not appear to be a valid iCal (.ics) feed');
  }

  return parseIcsText(text, feed, windowStart, windowEnd);
}

export function generateDemoEvents(now: Date, timeZone: string): {
  events: CalendarEvent[];
  status: CalendarSyncStatus[];
} {
  const todayStr = toDateOnlyLocal(now, timeZone);
  const [y, m, d] = todayStr.split('-').map(Number);

  // Helper to build a date string N days from today
  const dayOffset = (offset: number): string => {
    const dt = new Date(Date.UTC(y, m - 1, d + offset));
    return toDateOnlyUTC(dt);
  };

  // Helper to build an ISO timestamp in Mountain Time (approx -07:00 MST / -06:00 MDT)
  const makeIso = (offsetDays: number, hour: number, minute = 0): string => {
    const base = new Date(Date.UTC(y, m - 1, d + offsetDays, hour + 7, minute, 0));
    return base.toISOString();
  };

  const feeds = [
    { id: 'demo-family', name: 'Family', color: '#f59e0b' },
    { id: 'demo-kids', name: 'Kids & School', color: '#38bdf8' },
    { id: 'demo-home', name: 'Santa Fe / Outdoors', color: '#34d399' },
  ];

  const events: CalendarEvent[] = [
    {
      id: 'demo-1',
      title: 'Farmers Market at the Railyard',
      start: makeIso(1, 8, 30),
      end: makeIso(1, 11, 0),
      allDay: false,
      location: 'Santa Fe Railyard',
      calendarId: 'demo-family',
      calendarName: 'Family',
      color: '#f59e0b',
    },
    {
      id: 'demo-2',
      title: 'Soccer Practice',
      start: makeIso(0, 16, 0),
      end: makeIso(0, 17, 30),
      allDay: false,
      location: 'MRC Fields',
      calendarId: 'demo-kids',
      calendarName: 'Kids & School',
      color: '#38bdf8',
    },
    {
      id: 'demo-3',
      title: 'Family Dinner — Green Chile Enchiladas',
      start: makeIso(0, 18, 30),
      end: makeIso(0, 19, 45),
      allDay: false,
      calendarId: 'demo-family',
      calendarName: 'Family',
      color: '#f59e0b',
    },
    {
      id: 'demo-4',
      title: 'Dale Ball Trails Morning Hike',
      start: makeIso(2, 9, 0),
      end: makeIso(2, 11, 30),
      allDay: false,
      location: 'Sierra del Norte Trailhead',
      calendarId: 'demo-home',
      calendarName: 'Santa Fe / Outdoors',
      color: '#34d399',
    },
    {
      id: 'demo-5',
      title: 'Piano Lesson',
      start: makeIso(3, 15, 30),
      end: makeIso(3, 16, 30),
      allDay: false,
      calendarId: 'demo-kids',
      calendarName: 'Kids & School',
      color: '#38bdf8',
    },
    {
      id: 'demo-6',
      title: 'School Spirit Day',
      start: dayOffset(4),
      end: dayOffset(5),
      allDay: true,
      calendarId: 'demo-kids',
      calendarName: 'Kids & School',
      color: '#38bdf8',
    },
    {
      id: 'demo-7',
      title: 'Dentist Appointment',
      start: makeIso(5, 10, 0),
      end: makeIso(5, 11, 0),
      allDay: false,
      location: 'St. Michael’s Dr',
      calendarId: 'demo-family',
      calendarName: 'Family',
      color: '#f59e0b',
    },
    {
      id: 'demo-8',
      title: 'Ski Santa Fe — Family Day',
      start: dayOffset(7),
      end: dayOffset(8),
      allDay: true,
      location: 'Hyde Park Rd',
      calendarId: 'demo-home',
      calendarName: 'Santa Fe / Outdoors',
      color: '#34d399',
    },
    {
      id: 'demo-9',
      title: 'Parent-Teacher Conferences',
      start: makeIso(9, 14, 0),
      end: makeIso(9, 15, 30),
      allDay: false,
      calendarId: 'demo-kids',
      calendarName: 'Kids & School',
      color: '#38bdf8',
    },
    {
      id: 'demo-10',
      title: 'Canyon Road Holiday Walk',
      start: makeIso(12, 17, 0),
      end: makeIso(12, 19, 30),
      allDay: false,
      location: 'Canyon Road',
      calendarId: 'demo-family',
      calendarName: 'Family',
      color: '#f59e0b',
    },
  ];

  const status: CalendarSyncStatus[] = feeds.map((f) => ({
    id: f.id,
    name: f.name,
    color: f.color,
    enabled: true,
    ok: true,
    eventCount: events.filter((e) => e.calendarId === f.id).length,
    lastSyncedAt: now.toISOString(),
  }));

  return { events, status };
}

export class CalendarService {
  private eventsByFeed = new Map<string, CalendarEvent[]>();
  private statusByFeed = new Map<string, CalendarSyncStatus>();
  private lastSyncAt: string | null = null;

  async refreshAll(feeds: CalendarFeedConfig[]): Promise<void> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 14 * DAY_MS);
    const windowEnd = new Date(now.getTime() + 50 * DAY_MS);

    const activeIds = new Set(feeds.map((f) => f.id));
    for (const id of this.eventsByFeed.keys()) {
      if (!activeIds.has(id)) {
        this.eventsByFeed.delete(id);
        this.statusByFeed.delete(id);
      }
    }

    await Promise.all(
      feeds.map(async (feed) => {
        if (!feed.enabled) {
          this.eventsByFeed.set(feed.id, []);
          this.statusByFeed.set(feed.id, {
            id: feed.id,
            name: feed.name,
            color: feed.color,
            enabled: false,
            ok: true,
            eventCount: 0,
            lastSyncedAt: this.statusByFeed.get(feed.id)?.lastSyncedAt ?? null,
          });
          return;
        }

        try {
          const events = await fetchAndParseFeed(feed, windowStart, windowEnd);
          this.eventsByFeed.set(feed.id, events);
          this.statusByFeed.set(feed.id, {
            id: feed.id,
            name: feed.name,
            color: feed.color,
            enabled: true,
            ok: true,
            eventCount: events.length,
            lastSyncedAt: new Date().toISOString(),
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to fetch calendar';
          console.error(`[calendar] Failed to sync "${feed.name}":`, message);
          const prev = this.statusByFeed.get(feed.id);
          // Preserve cached events on transient network error
          this.statusByFeed.set(feed.id, {
            id: feed.id,
            name: feed.name,
            color: feed.color,
            enabled: true,
            ok: false,
            eventCount: this.eventsByFeed.get(feed.id)?.length ?? 0,
            lastSyncedAt: prev?.lastSyncedAt ?? null,
            error: message,
          });
        }
      })
    );

    this.lastSyncAt = new Date().toISOString();
  }

  getSnapshot(
    feeds: CalendarFeedConfig[],
    demoMode: boolean,
    timeZone: string
  ): {
    events: CalendarEvent[];
    status: CalendarSyncStatus[];
    usingDemoData: boolean;
    lastSyncAt: string | null;
  } {
    const enabledFeeds = feeds.filter((f) => f.enabled);
    if (enabledFeeds.length === 0 && demoMode) {
      const demo = generateDemoEvents(new Date(), timeZone);
      return {
        events: demo.events,
        status: demo.status,
        usingDemoData: true,
        lastSyncAt: new Date().toISOString(),
      };
    }

    const events: CalendarEvent[] = [];
    const status: CalendarSyncStatus[] = [];

    for (const feed of feeds) {
      if (feed.enabled) {
        events.push(...(this.eventsByFeed.get(feed.id) ?? []));
      }
      status.push(
        this.statusByFeed.get(feed.id) ?? {
          id: feed.id,
          name: feed.name,
          color: feed.color,
          enabled: feed.enabled,
          ok: true,
          eventCount: 0,
          lastSyncedAt: null,
        }
      );
    }

    events.sort((a, b) => a.start.localeCompare(b.start));

    return {
      events,
      status,
      usingDemoData: false,
      lastSyncAt: this.lastSyncAt,
    };
  }
}
