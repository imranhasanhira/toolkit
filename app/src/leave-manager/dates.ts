export type RangeMode = 'all' | 'weekday';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateString(value: string): boolean {
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Local calendar day for a Date created in the UI (not a Prisma `@db.Date`). */
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calendar day for a Prisma `@db.Date` (UTC midnight) or an ISO/date string.
 * Uses UTC parts so timezones cannot shift the day.
 */
export function toDateString(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
    return match ? match[1] : null;
  }
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** UTC midnight for a calendar day, so `@db.Date` stores that day in every timezone. */
export function dateFromDateString(dateString: string): Date {
  const match = DATE_RE.exec(dateString);
  if (!match) {
    throw new Error(`Invalid date string: ${dateString}`);
  }
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function addDays(dateString: string, days: number): string {
  const date = dateFromDateString(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function weekdayOfDateString(dateString: string): number {
  return dateFromDateString(dateString).getUTCDay();
}

export function isWeekendDateString(dateString: string): boolean {
  const weekday = weekdayOfDateString(dateString);
  return weekday === 0 || weekday === 6;
}

export function eachDateString(start: string, end: string): string[] {
  const from = start <= end ? start : end;
  const to = start <= end ? end : start;
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function isDateWithinRange(dateString: string, startDate: string, endDate: string | null): boolean {
  if (dateString < startDate) return false;
  if (endDate && dateString > endDate) return false;
  return true;
}

export function expandDateRange(
  start: Date | string,
  end: Date | string,
  options: {
    mode: RangeMode;
    skipWeekends?: boolean;
    holidayDateStrings?: Iterable<string>;
  }
): string[] {
  const startString = typeof start === 'string' ? start : formatDateString(start);
  const endString = typeof end === 'string' ? end : formatDateString(end);
  const holidays = new Set(options.holidayDateStrings ?? []);
  const skipWeekends = options.skipWeekends !== false;
  const anchorWeekday = weekdayOfDateString(startString);

  return eachDateString(startString, endString).filter((dateString) => {
    if (skipWeekends && isWeekendDateString(dateString)) return false;
    if (holidays.has(dateString)) return false;
    if (options.mode === 'weekday' && weekdayOfDateString(dateString) !== anchorWeekday) return false;
    return true;
  });
}
