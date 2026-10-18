import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../client/components/ui/dropdown-menu';
import { addDays, expandDateRange, formatDateString, isDateWithinRange, isWeekendDateString } from '../dates';
import { GovernmentHoliday, LeaveCategory, LeaveDate, LeaveProject, MarkMode, RangeMode } from '../types';

interface CalendarProps {
  projects: LeaveProject[];
  activeProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  currentCategory: LeaveCategory | null;
  leaveDates: LeaveDate[];
  governmentHolidays: GovernmentHoliday[];
  categories: LeaveCategory[];
  rangeMode: RangeMode;
  markMode: MarkMode;
  includeWeekends: boolean;
  onIncludeWeekendsChange: (includeWeekends: boolean) => void;
  onDateToggle: (date: Date, category: LeaveCategory) => void;
  onDateRangeToggle: (startDate: Date, endDate: Date, category: LeaveCategory) => void;
}

type ViewUnit = 'day' | 'week' | 'month' | 'year';

const VIEW_UNITS: { id: ViewUnit; label: string; name: string }[] = [
  { id: 'day', label: 'D', name: 'Days' },
  { id: 'week', label: 'W', name: 'Weeks' },
  { id: 'month', label: 'M', name: 'Months' },
  { id: 'year', label: 'Y', name: 'Year' },
];

const VIEW_LIMITS: Record<Exclude<ViewUnit, 'year'>, { min: number; max: number; fallback: number }> = {
  day: { min: 1, max: 31, fallback: 7 },
  week: { min: 1, max: 12, fallback: 4 },
  month: { min: 1, max: 24, fallback: 13 },
};

type LineBar = {
  category: LeaveCategory;
  lane: number;
  continuesLeft: boolean;
  continuesRight: boolean;
};

type DayPaint = { kind: 'empty' } | { kind: 'fill'; category: LeaveCategory } | { kind: 'lines'; bars: LineBar[] };

function buildMarkModel(leaveDates: LeaveDate[], categories: LeaveCategory[]) {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const idsByDate = new Map<string, string[]>();
  const datesByCategory = new Map<string, string[]>();

  for (const item of leaveDates) {
    if (!byId.has(item.categoryId)) continue;
    const dayIds = idsByDate.get(item.date) ?? [];
    if (!dayIds.includes(item.categoryId)) dayIds.push(item.categoryId);
    idsByDate.set(item.date, dayIds);
    const catDates = datesByCategory.get(item.categoryId) ?? [];
    catDates.push(item.date);
    datesByCategory.set(item.categoryId, catDates);
  }

  let useLines = false;
  for (const ids of idsByDate.values()) {
    if (ids.length >= 2) {
      useLines = true;
      break;
    }
  }

  const marked = new Set<string>();
  if (useLines) {
    for (const [categoryId, dates] of datesByCategory) {
      for (const date of dates) marked.add(`${categoryId}|${date}`);
    }
  }

  const laneOf = new Map(
    [...datesByCategory.keys()]
      .sort((a, b) => (byId.get(a)?.name ?? '').localeCompare(byId.get(b)?.name ?? ''))
      .map((id, index) => [id, index])
  );

  const paint = (dateString: string): DayPaint => {
    const ids = [...(idsByDate.get(dateString) ?? [])].sort((a, b) =>
      (byId.get(a)?.name ?? '').localeCompare(byId.get(b)?.name ?? '')
    );
    if (ids.length === 0) return { kind: 'empty' };
    if (!useLines) {
      const category = byId.get(ids[0]);
      return category ? { kind: 'fill', category } : { kind: 'empty' };
    }
    const bars: LineBar[] = [];
    for (const id of ids) {
      const category = byId.get(id);
      if (!category) continue;
      bars.push({
        category,
        lane: laneOf.get(id) ?? 0,
        continuesLeft: marked.has(`${id}|${addDays(dateString, -1)}`),
        continuesRight: marked.has(`${id}|${addDays(dateString, 1)}`),
      });
    }
    return bars.length > 0 ? { kind: 'lines', bars } : { kind: 'empty' };
  };

  const categoriesOn = (dateString: string): LeaveCategory[] =>
    (idsByDate.get(dateString) ?? [])
      .map((id) => byId.get(id))
      .filter((category): category is LeaveCategory => Boolean(category))
      .sort((a, b) => a.name.localeCompare(b.name));

  return { paint, categoriesOn };
}

function startOfWeekMonday(date: Date): Date {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = day.getDay() === 0 ? 6 : day.getDay() - 1;
  day.setDate(day.getDate() - offset);
  return day;
}

function parseDateString(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function normalizeStart(date: Date, unit: ViewUnit): Date {
  if (unit === 'year') return new Date(date.getFullYear(), 0, 1);
  if (unit === 'month') return new Date(date.getFullYear(), date.getMonth(), 1);
  if (unit === 'week') return startOfWeekMonday(date);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatSpan(start: Date, unit: ViewUnit, count: number): string {
  if (unit === 'year') return String(start.getFullYear());
  if (unit === 'month') {
    const end = new Date(start.getFullYear(), start.getMonth() + count - 1, 1);
    const startLabel = start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    if (count === 1) return startLabel;
    return `${startLabel} – ${end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
  }
  const origin = unit === 'week' ? startOfWeekMonday(start) : start;
  const end = parseDateString(addDays(formatDateString(origin), (unit === 'week' ? count * 7 : count) - 1));
  const startLabel = origin.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (count === 1 && unit === 'day') return origin.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startLabel} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export const Calendar: React.FC<CalendarProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  currentCategory,
  leaveDates,
  governmentHolidays,
  categories,
  rangeMode,
  markMode,
  includeWeekends,
  onIncludeWeekendsChange,
  onDateToggle,
  onDateRangeToggle,
}) => {
  const [unit, setUnit] = useState<ViewUnit>('month');
  const [counts, setCounts] = useState({ day: 7, week: 4, month: 13 });
  const [daysPerLine, setDaysPerLine] = useState(14);
  const [viewStart, setViewStart] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [anchorDate, setAnchorDate] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [dateMenu, setDateMenu] = useState<{ dateString: string; x: number; y: number } | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ dateString: string; x: number; y: number } | null>(null);
  const [dragRange, setDragRange] = useState<{ start: Date; end: Date } | null>(null);
  const pressRef = useRef<{ timer: number; x: number; y: number } | null>(null);
  const ignoreClickUntilRef = useRef(0);
  const swallowReleaseRef = useRef(false);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  const count = unit === 'year' ? 12 : counts[unit];
  const marks = useMemo(() => buildMarkModel(leaveDates, categories), [leaveDates, categories]);

  const holidayDateStrings = useMemo(
    () => governmentHolidays.map((holiday) => holiday.date),
    [governmentHolidays]
  );

  useEffect(() => {
    setAnchorDate(null);
    setHoverDate(null);
    setDragRange(null);
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
  }, [markMode, rangeMode, currentCategory?.id]);

  useEffect(() => () => dragCleanupRef.current?.(), []);

  const previewDates = useMemo(() => {
    const start = dragRange?.start ?? (markMode === 'range' ? anchorDate : null);
    const end = dragRange?.end ?? (markMode === 'range' ? hoverDate : null);
    if (!start || !end || !currentCategory) return new Set<string>();
    return new Set(
      expandDateRange(start, end, {
        mode: rangeMode,
        skipWeekends: !includeWeekends,
        holidayDateStrings,
      }).filter((dateString) => isDateWithinRange(dateString, currentCategory.startDate, currentCategory.endDate))
    );
  }, [dragRange, markMode, anchorDate, hoverDate, currentCategory, rangeMode, holidayDateStrings, includeWeekends]);

  const isGovernmentHoliday = (date: Date): boolean => holidayDateStrings.includes(formatDateString(date));

  const getDaysInMonth = (date: Date): (Date | null)[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDay.getDay();
    const mondayOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const days: (Date | null)[] = [];

    for (let i = 0; i < mondayOffset; i += 1) days.push(null);
    for (let day = 1; day <= lastDay.getDate(); day += 1) days.push(new Date(year, month, day));
    return days;
  };

  const canMark = (date: Date) => {
    if (!currentCategory) return false;
    if (!includeWeekends && isWeekendDateString(formatDateString(date))) return false;
    if (isGovernmentHoliday(date)) return false;
    return true;
  };

  const cancelPress = () => {
    if (pressRef.current) {
      window.clearTimeout(pressRef.current.timer);
      pressRef.current = null;
    }
  };

  const openDateMenu = (dateString: string, x: number, y: number, swallowRelease: boolean) => {
    const menuWidth = 220;
    const menuHeight = 160;
    ignoreClickUntilRef.current = Date.now() + 500;
    swallowReleaseRef.current = swallowRelease;
    setHoverInfo(null);
    setDateMenu({
      dateString,
      x: Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - menuHeight - 8)),
    });
  };

  useEffect(() => {
    if (!dateMenu) return;
    const close = () => setDateMenu(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [dateMenu]);

  const beginMouseDrag = (event: React.PointerEvent, date: Date) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !currentCategory || !canMark(date)) return;
    dragCleanupRef.current?.();

    const originX = event.clientX;
    const originY = event.clientY;
    const start = date;
    let end = date;
    let moved = false;
    let last = formatDateString(start);

    const onMove = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - originX, ev.clientY - originY) <= 6) return;
      moved = true;
      cancelPress();
      setDateMenu(null);
      const value = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-date]')?.getAttribute('data-date');
      if (!value || value === last) return;
      last = value;
      const [year, month, day] = value.split('-').map(Number);
      end = new Date(year, month - 1, day);
      setDragRange({ start, end });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      dragCleanupRef.current = null;
      setDragRange(null);
      if (!moved || formatDateString(start) === formatDateString(end)) return;
      ignoreClickUntilRef.current = Date.now() + 400;
      setAnchorDate(null);
      setHoverDate(null);
      onDateRangeToggle(start, end, currentCategory);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    dragCleanupRef.current = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  };

  const handleDateClick = (date: Date) => {
    if (Date.now() < ignoreClickUntilRef.current) return;
    if (!canMark(date) || !currentCategory) return;
    if (markMode === 'single') {
      onDateToggle(date, currentCategory);
      return;
    }

    if (!anchorDate) {
      setAnchorDate(date);
      setHoverDate(date);
      return;
    }

    const start = anchorDate;
    setAnchorDate(null);
    setHoverDate(null);
    if (formatDateString(start) === formatDateString(date)) {
      onDateToggle(date, currentCategory);
      return;
    }
    onDateRangeToggle(start, date, currentCategory);
  };

  const shiftView = (direction: -1 | 1) => {
    setViewStart((current) => {
      if (unit === 'day') {
        const next = new Date(current);
        next.setDate(next.getDate() + direction);
        return next;
      }
      if (unit === 'week') {
        const next = startOfWeekMonday(current);
        next.setDate(next.getDate() + direction * 7);
        return next;
      }
      if (unit === 'month') return new Date(current.getFullYear(), current.getMonth() + direction, 1);
      return new Date(current.getFullYear() + direction, 0, 1);
    });
  };

  const selectUnit = (next: ViewUnit) => {
    setUnit(next);
    setViewStart((current) => normalizeStart(current, next));
  };

  const setCount = (value: number) => {
    if (unit === 'year') return;
    const limit = VIEW_LIMITS[unit];
    const next = Math.min(limit.max, Math.max(limit.min, value));
    if (!Number.isFinite(next)) return;
    setCounts((current) => ({ ...current, [unit]: next }));
  };

  const monthsRange =
    unit === 'month' || unit === 'year'
      ? Array.from({ length: count }, (_, index) => new Date(viewStart.getFullYear(), viewStart.getMonth() + index, 1))
      : [];
  const stripDates =
    unit === 'day' || unit === 'week'
      ? Array.from({ length: unit === 'week' ? count * 7 : count }, (_, index) => {
          const day = unit === 'week' ? startOfWeekMonday(viewStart) : new Date(viewStart);
          day.setDate(day.getDate() + index);
          return day;
        })
      : [];
  const lineColumns = Math.min(daysPerLine, Math.max(stripDates.length, 1));

  const weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const cellMin = unit === 'day' || unit === 'week' ? 'min-h-14' : 'min-h-8';
  const gridClass =
    unit === 'day' || unit === 'week' || count === 1
      ? 'grid grid-cols-1 gap-3'
      : count <= 3
        ? 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3'
        : count <= 6
          ? 'grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3'
          : 'grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

  const skipped = includeWeekends ? 'Holidays are skipped.' : 'Weekends and holidays are skipped.';
  const tip =
    markMode === 'range'
      ? anchorDate
        ? 'Tap the end day. Tap the same day again to mark only that day.'
        : rangeMode === 'weekday'
          ? `Tap a start day, then an end day, or drag across days. Only that weekday is marked. ${skipped}`
          : `Tap a start day, then an end day, or drag across days. ${skipped}`
      : `Click a day to add or remove the selected category. Drag across days to mark a range. ${skipped}`;

  const renderDay = (date: Date) => {
    const dateString = formatDateString(date);
    const isWeekendDay = isWeekendDateString(dateString);
    const isHoliday = isGovernmentHoliday(date);
    const dayCategories = marks.categoriesOn(dateString);
    const holiday = governmentHolidays.find((item) => item.date === dateString);
    const isPreview = previewDates.has(dateString);
    const isAnchor = anchorDate != null && formatDateString(anchorDate) === dateString;
    const weekendBlocked = isWeekendDay && !includeWeekends;
    const isBlocked = weekendBlocked || isHoliday || !currentCategory;
    const paint = isHoliday ? ({ kind: 'empty' } as DayPaint) : marks.paint(dateString);
    const markedLabel = dayCategories.map((category) => category.name).join(', ');
    const lineHeight = paint.kind === 'lines' ? 4 + Math.max(...paint.bars.map((bar) => bar.lane)) * 5 : 0;

    return (
      <button
        key={dateString}
        type="button"
        data-date={dateString}
        onClick={() => handleDateClick(date)}
        onContextMenu={(event) => {
          event.preventDefault();
          cancelPress();
          openDateMenu(dateString, event.clientX, event.clientY, false);
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          beginMouseDrag(event, date);
          cancelPress();
          const x = event.clientX;
          const y = event.clientY;
          const timer = window.setTimeout(() => {
            pressRef.current = null;
            openDateMenu(dateString, x, y, true);
          }, 450);
          pressRef.current = { timer, x, y };
        }}
        onPointerMove={(event) => {
          const press = pressRef.current;
          if (!press) return;
          if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10) cancelPress();
        }}
        onPointerUp={cancelPress}
        onPointerCancel={cancelPress}
        onPointerEnter={(event) => {
          if (markMode === 'range' && anchorDate && canMark(date)) setHoverDate(date);
          if (event.pointerType !== 'mouse') return;
          if (dayCategories.length === 0 && !holiday) return;
          setHoverInfo({ dateString, x: event.clientX, y: event.clientY });
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== 'mouse') return;
          setHoverInfo((current) => (current?.dateString === dateString ? null : current));
        }}
        aria-disabled={isBlocked}
        className={`relative flex w-full items-center justify-center overflow-visible rounded px-0.5 text-xs font-medium ${cellMin} ${
          weekendBlocked
            ? 'cursor-not-allowed bg-gray-100 text-gray-400'
            : isHoliday
              ? 'cursor-not-allowed border border-red-300 bg-red-100 text-red-700'
              : paint.kind === 'fill'
                ? 'text-white'
                : !currentCategory
                  ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
        } ${isAnchor ? 'ring-2 ring-blue-500' : isPreview ? 'ring-2 ring-blue-400' : ''}`}
        style={{
          ...(paint.kind === 'fill' ? { backgroundColor: paint.category.color } : {}),
          ...(lineHeight > 0 ? { paddingBottom: lineHeight + 2 } : {}),
        }}
        title={
          holiday
            ? markedLabel
              ? `${holiday.name} (holiday). ${markedLabel}`
              : `${holiday.name} (holiday)`
            : markedLabel
              ? markedLabel
              : !currentCategory
                ? 'Select a leave category first'
                : date.toLocaleDateString()
        }
      >
        <span className="leading-none">{date.getDate()}</span>
        {paint.kind === 'lines' &&
          paint.bars.map((bar) => (
            <span
              key={bar.category.id}
              className="absolute h-1"
              style={{
                backgroundColor: bar.category.color,
                bottom: 2 + bar.lane * 5,
                left: bar.continuesLeft ? -1 : 3,
                right: bar.continuesRight ? -1 : 3,
                borderTopLeftRadius: bar.continuesLeft ? 0 : 999,
                borderBottomLeftRadius: bar.continuesLeft ? 0 : 999,
                borderTopRightRadius: bar.continuesRight ? 0 : 999,
                borderBottomRightRadius: bar.continuesRight ? 0 : 999,
              }}
            />
          ))}
      </button>
    );
  };

  return (
    <div className="select-none rounded-lg bg-white p-3 shadow">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <ProjectHeading projects={projects} activeProjectId={activeProjectId} onSelectProject={onSelectProject} />
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={includeWeekends}
              onChange={(event) => onIncludeWeekendsChange(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300"
            />
            Weekends
          </label>
          <div className="inline-flex overflow-hidden rounded border border-gray-200">
            {VIEW_UNITS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectUnit(item.id)}
                aria-pressed={unit === item.id}
                title={item.name}
                className={`px-2 py-1 text-xs font-medium ${
                  unit === item.id ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {unit !== 'year' && (
            <input
              type="number"
              inputMode="numeric"
              aria-label={`Number of ${unit}s`}
              min={VIEW_LIMITS[unit].min}
              max={VIEW_LIMITS[unit].max}
              value={counts[unit]}
              onChange={(event) => setCount(Number(event.target.value))}
              className="w-14 rounded border border-gray-200 px-1.5 py-1 text-xs text-gray-800"
            />
          )}
          {(unit === 'day' || unit === 'week') && (
            <label className="inline-flex items-center gap-1 text-xs text-gray-600">
              <span>Per line</span>
              <input
                type="number"
                inputMode="numeric"
                aria-label="Days per line"
                min={1}
                max={42}
                value={daysPerLine}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (!Number.isFinite(next)) return;
                  setDaysPerLine(Math.min(42, Math.max(1, next)));
                }}
                className="w-14 rounded border border-gray-200 px-1.5 py-1 text-xs text-gray-800"
              />
            </label>
          )}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shiftView(-1)}
              className="rounded p-1 text-gray-600 hover:bg-gray-100"
              aria-label={`Previous ${unit}`}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <span className="min-w-0 text-xs text-gray-600">{formatSpan(viewStart, unit, count)}</span>
            <button
              type="button"
              onClick={() => shiftView(1)}
              className="rounded p-1 text-gray-600 hover:bg-gray-100"
              aria-label={`Next ${unit}`}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {!currentCategory && (
        <p className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
          Select a leave category before marking dates.
        </p>
      )}

      {unit === 'month' || unit === 'year' ? (
        <div className={gridClass}>
          {monthsRange.map((month) => (
            <div key={`${month.getFullYear()}-${month.getMonth()}`} className="min-w-0">
              <h3 className="mb-1 text-center text-sm font-medium text-gray-900">
                {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <div className="grid grid-cols-7 gap-0.5">
                {weekdays.map((day) => (
                  <div key={day} className="py-0.5 text-center text-[10px] font-medium text-gray-500">
                    {day}
                  </div>
                ))}
                {getDaysInMonth(month).map((date, dayIndex) =>
                  date ? renderDay(date) : <div key={`empty-${month.getMonth()}-${dayIndex}`} className={cellMin} />
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div
            className="grid gap-0.5"
            style={{ gridTemplateColumns: `repeat(${lineColumns}, minmax(2.75rem, 1fr))` }}
          >
            {stripDates.map((date) => (
              <div key={formatDateString(date)} className="min-w-0">
                <div className="py-0.5 text-center text-[10px] font-medium text-gray-500">
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                {renderDay(date)}
              </div>
            ))}
          </div>
        </div>
      )}

      {currentCategory && (
        <p className="mt-2 rounded border border-blue-100 bg-blue-50 px-2 py-1 text-xs text-blue-800">{tip}</p>
      )}

      {dateMenu && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close date menu"
            onClick={() => {
              if (swallowReleaseRef.current) {
                swallowReleaseRef.current = false;
                return;
              }
              setDateMenu(null);
            }}
          />
          <div
            role="menu"
            className="fixed z-50 max-h-52 min-w-44 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 shadow-md"
            style={{ left: dateMenu.x, top: dateMenu.y }}
          >
            <DateMarkList
              dateString={dateMenu.dateString}
              categories={categories}
              leaveDates={leaveDates}
              holidayName={governmentHolidays.find((item) => item.date === dateMenu.dateString)?.name}
            />
          </div>
        </>
      )}

      {hoverInfo && !dateMenu && (
        <div
          className="pointer-events-none fixed z-50 max-w-56 rounded-md border border-gray-200 bg-white p-1 shadow-md"
          style={{
            left: Math.max(8, Math.min(hoverInfo.x, window.innerWidth - 200)),
            top: Math.max(8, hoverInfo.y + 14),
          }}
        >
          <DateMarkList
            dateString={hoverInfo.dateString}
            categories={categories}
            leaveDates={leaveDates}
            holidayName={governmentHolidays.find((item) => item.date === hoverInfo.dateString)?.name}
          />
        </div>
      )}
    </div>
  );
};

function DateMarkList({
  dateString,
  categories,
  leaveDates,
  holidayName,
}: {
  dateString: string;
  categories: LeaveCategory[];
  leaveDates: LeaveDate[];
  holidayName?: string;
}) {
  const marked = categories
    .filter((category) => leaveDates.some((item) => item.date === dateString && item.categoryId === category.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="px-1.5 py-1">
      {holidayName && <div className="text-xs font-medium text-red-700">{holidayName}</div>}
      {marked.length === 0 && <div className="text-sm text-gray-500">Not marked</div>}
      {marked.map((category) => (
        <div key={category.id} className="flex items-center gap-2 py-0.5 text-sm text-gray-800">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
          <span>{category.name}</span>
        </div>
      ))}
    </div>
  );
}

function ProjectHeading({
  projects,
  activeProjectId,
  onSelectProject,
}: {
  projects: LeaveProject[];
  activeProjectId: string | null;
  onSelectProject: (projectId: string) => void;
}) {
  const activeProjects = projects.filter((project) => !project.isArchived);
  const current = projects.find((project) => project.id === activeProjectId) ?? null;
  const canSwitch = activeProjects.length > 1 && !current?.isArchived;

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: current?.color || '#2563EB' }} />
      {canSwitch ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Project"
              className="inline-flex min-w-0 items-center gap-1 rounded-md py-0.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <span className="truncate text-base font-semibold text-gray-900">{current?.name ?? 'Project'}</span>
              <ChevronDownIcon className="h-4 w-4 shrink-0 text-gray-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="z-50 min-w-[10rem] border-gray-200 bg-white text-gray-900 shadow-lg">
            {activeProjects.map((project) => (
              <DropdownMenuItem key={project.id} onSelect={() => onSelectProject(project.id)}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: project.color || '#2563EB' }} />
                <span className="min-w-0 flex-1 truncate">{project.name}</span>
                {project.id === activeProjectId && <CheckIcon className="h-4 w-4 shrink-0 text-gray-700" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <h2 className="truncate text-base font-semibold text-gray-900">{current?.name ?? 'Project'}</h2>
      )}
      {current?.isArchived && (
        <span className="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">
          Archived
        </span>
      )}
    </div>
  );
}
