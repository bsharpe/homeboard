import type { CalendarEvent, CalendarGridMode } from '../../../shared/types';

export interface GridDay {
  dateKey: string; // YYYY-MM-DD
  dayNumber: number;
  monthShort: string;
  isToday: boolean;
  isPast: boolean;
  isCurrentMonth: boolean;
  isNextMonth: boolean;
  events: CalendarEvent[];
}

export interface AgendaDayGroup {
  dateKey: string;
  label: string;
  sublabel: string;
  isToday: boolean;
  events: CalendarEvent[];
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function getDateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

export function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function addDaysToKey(dateKey: string, days: number): string {
  const dt = parseDateKey(dateKey);
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

export function getHourInTimeZone(date: Date, timeZone: string): number {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hour12: false,
  }).format(date);
  const n = Number(hourStr);
  return n === 24 ? 0 : n;
}

export function formatClock(
  date: Date,
  timeZone: string,
  clockFormat: '12h' | '24h',
  showSeconds: boolean
): { time: string; period: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: clockFormat === '24h' ? '2-digit' : 'numeric',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
    hour12: clockFormat === '12h',
  }).formatToParts(date);

  const period = parts.find((p) => p.type === 'dayPeriod')?.value ?? '';
  const time = parts
    .filter((p) => p.type !== 'dayPeriod')
    .map((p) => p.value)
    .join('')
    .trim();

  return { time, period };
}

export function formatFullDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function formatEventTime(
  iso: string,
  timeZone: string,
  clockFormat: '12h' | '24h'
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: clockFormat === '24h' ? '2-digit' : 'numeric',
    minute: '2-digit',
    hour12: clockFormat === '12h',
  }).format(d);

  if (clockFormat === '12h') {
    return formatted.replace(':00 ', ' ').replace(' AM', 'a').replace(' PM', 'p');
  }
  return formatted;
}

export function formatEventTimeRange(
  ev: CalendarEvent,
  timeZone: string,
  clockFormat: '12h' | '24h'
): string {
  if (ev.allDay) return 'All day';
  const start = formatEventTime(ev.start, timeZone, clockFormat);
  const end = formatEventTime(ev.end, timeZone, clockFormat);
  if (!end || start === end) return start;
  return `${start} – ${end}`;
}

export function formatHourlyLabel(localIso: string, clockFormat: '12h' | '24h'): string {
  // Open-Meteo returns local ISO like "2026-11-20T14:00"
  const hourPart = Number(localIso.slice(11, 13));
  if (Number.isNaN(hourPart)) return '';
  if (clockFormat === '24h') return `${pad2(hourPart)}:00`;
  if (hourPart === 0) return '12a';
  if (hourPart < 12) return `${hourPart}a`;
  if (hourPart === 12) return '12p';
  return `${hourPart - 12}p`;
}

export function formatShortWeekday(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return 'Today';
  const dt = parseDateKey(dateKey);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
  }).format(dt);
}

export function mapEventsByDay(
  events: CalendarEvent[],
  timeZone: string
): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();

  const pushToDay = (dayKey: string, ev: CalendarEvent) => {
    const list = map.get(dayKey);
    if (list) {
      list.push(ev);
    } else {
      map.set(dayKey, [ev]);
    }
  };

  for (const ev of events) {
    if (ev.allDay) {
      const startKey = ev.start.slice(0, 10);
      const endKey = ev.end.slice(0, 10);
      let cursor = startKey;
      let guard = 0;
      do {
        pushToDay(cursor, ev);
        cursor = addDaysToKey(cursor, 1);
        guard++;
      } while (cursor < endKey && guard < 60);
    } else {
      const startDate = new Date(ev.start);
      if (Number.isNaN(startDate.getTime())) continue;
      const startKey = getDateKeyInTimeZone(startDate, timeZone);
      pushToDay(startKey, ev);
    }
  }

  for (const list of map.values()) {
    list.sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      if (a.allDay && b.allDay) {
        const aMulti = addDaysToKey(a.start.slice(0, 10), 1) < a.end.slice(0, 10);
        const bMulti = addDaysToKey(b.start.slice(0, 10), 1) < b.end.slice(0, 10);
        if (aMulti !== bMulti) return aMulti ? -1 : 1;
        const startCmp = a.start.localeCompare(b.start);
        if (startCmp !== 0) return startCmp;
        const endCmp = b.end.localeCompare(a.end);
        if (endCmp !== 0) return endCmp;
        return a.id.localeCompare(b.id);
      }
      return a.start.localeCompare(b.start);
    });
  }

  return map;
}

export interface MultiDaySpanInfo {
  isMultiDay: boolean;
  continuesLeft: boolean;
  continuesRight: boolean;
  connectsLeftInRow: boolean;
  connectsRightInRow: boolean;
  showLabel: boolean;
}

export function getMultiDaySpanInfo(
  ev: CalendarEvent,
  dateKey: string,
  colIndex: number
): MultiDaySpanInfo {
  if (!ev.allDay) {
    return {
      isMultiDay: false,
      continuesLeft: false,
      continuesRight: false,
      connectsLeftInRow: false,
      connectsRightInRow: false,
      showLabel: true,
    };
  }
  const startKey = ev.start.slice(0, 10);
  const endKey = ev.end.slice(0, 10);
  const isMultiDay = addDaysToKey(startKey, 1) < endKey;
  if (!isMultiDay) {
    return {
      isMultiDay: false,
      continuesLeft: false,
      continuesRight: false,
      connectsLeftInRow: false,
      connectsRightInRow: false,
      showLabel: true,
    };
  }

  const continuesLeft = dateKey > startKey;
  const continuesRight = addDaysToKey(dateKey, 1) < endKey;
  const connectsLeftInRow = continuesLeft && colIndex > 0;
  const connectsRightInRow = continuesRight && colIndex < 6;
  const showLabel = !continuesLeft || colIndex === 0;

  return {
    isMultiDay: true,
    continuesLeft,
    continuesRight,
    connectsLeftInRow,
    connectsRightInRow,
    showLabel,
  };
}

export function buildCalendarGrid(
  now: Date,
  timeZone: string,
  gridMode: CalendarGridMode,
  weekStartsOn: 0 | 1,
  eventsByDay: Map<string, CalendarEvent[]>
): { days: GridDay[]; monthHeading: string; weekCount: number } {
  const todayKey = getDateKeyInTimeZone(now, timeZone);
  const todayUtc = parseDateKey(todayKey);
  const currentYear = todayUtc.getUTCFullYear();
  const currentMonth = todayUtc.getUTCMonth();
  const currentMonthIndex = currentYear * 12 + currentMonth;

  let startKey: string;
  let totalDays: number;

  if (gridMode === 'month') {
    const firstOfMonth = new Date(Date.UTC(todayUtc.getUTCFullYear(), currentMonth, 1, 12));
    const firstDow = firstOfMonth.getUTCDay();
    const offset = (firstDow - weekStartsOn + 7) % 7;
    const firstKey = `${firstOfMonth.getUTCFullYear()}-${pad2(currentMonth + 1)}-01`;
    startKey = addDaysToKey(firstKey, -offset);

    const daysInMonth = new Date(
      Date.UTC(todayUtc.getUTCFullYear(), currentMonth + 1, 0)
    ).getUTCDate();
    const totalCells = offset + daysInMonth;
    totalDays = totalCells > 35 ? 42 : 35;
  } else {
    // 4-week rolling view starting from the beginning of the current week
    const todayDow = todayUtc.getUTCDay();
    const offset = (todayDow - weekStartsOn + 7) % 7;
    startKey = addDaysToKey(todayKey, -offset);
    totalDays = 28;
  }

  const days: GridDay[] = [];
  for (let i = 0; i < totalDays; i++) {
    const dateKey = addDaysToKey(startKey, i);
    const dt = parseDateKey(dateKey);
    const dayMonthIndex = dt.getUTCFullYear() * 12 + dt.getUTCMonth();
    days.push({
      dateKey,
      dayNumber: dt.getUTCDate(),
      monthShort: new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        month: 'short',
      }).format(dt),
      isToday: dateKey === todayKey,
      isPast: dateKey < todayKey,
      isCurrentMonth: dayMonthIndex === currentMonthIndex,
      isNextMonth: dayMonthIndex > currentMonthIndex,
      events: eventsByDay.get(dateKey) ?? [],
    });
  }

  const firstMonthName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(parseDateKey(days[0].dateKey));

  const lastMonthName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(parseDateKey(days[days.length - 1].dateKey));

  const monthHeading =
    gridMode === 'month'
      ? new Intl.DateTimeFormat('en-US', {
          timeZone: 'UTC',
          month: 'long',
          year: 'numeric',
        }).format(todayUtc)
      : firstMonthName === lastMonthName
        ? firstMonthName
        : `${firstMonthName.split(' ')[0]} – ${lastMonthName}`;

  return {
    days,
    monthHeading,
    weekCount: totalDays / 7,
  };
}

export function buildAgendaGroups(
  now: Date,
  timeZone: string,
  agendaDays: number,
  eventsByDay: Map<string, CalendarEvent[]>
): AgendaDayGroup[] {
  const todayKey = getDateKeyInTimeZone(now, timeZone);
  const tomorrowKey = addDaysToKey(todayKey, 1);
  const groups: AgendaDayGroup[] = [];

  for (let i = 0; i < agendaDays; i++) {
    const dateKey = addDaysToKey(todayKey, i);
    const rawEvents = eventsByDay.get(dateKey) ?? [];
    // Filter out timed events from today that already ended
    const events =
      i === 0
        ? rawEvents.filter((ev) => ev.allDay || new Date(ev.end).getTime() > now.getTime())
        : rawEvents;

    if (events.length === 0 && i > 0) continue;

    const dt = parseDateKey(dateKey);
    const dateSublabel = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
    }).format(dt);

    const weekdayLabel = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      weekday: 'long',
    }).format(dt);

    const label =
      dateKey === todayKey
        ? 'Today'
        : dateKey === tomorrowKey
          ? 'Tomorrow'
          : weekdayLabel;

    groups.push({
      dateKey,
      label,
      sublabel: dateSublabel,
      isToday: dateKey === todayKey,
      events,
    });
  }

  return groups;
}

export function getWeekdayHeaders(weekStartsOn: 0 | 1): string[] {
  return weekStartsOn === 1
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
}
