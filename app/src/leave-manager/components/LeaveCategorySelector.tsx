import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LeaveCategory, LeaveDate, MarkMode, RangeMode } from '../types';

interface LeaveCategorySelectorProps {
  categories: LeaveCategory[];
  currentCategory: LeaveCategory | null;
  onCategoryChange: (category: LeaveCategory | null) => void;
  leaveDates?: LeaveDate[];
  rangeMode: RangeMode;
  onRangeModeChange: (mode: RangeMode) => void;
  markMode: MarkMode;
  onMarkModeChange: (mode: MarkMode) => void;
}

export const LeaveCategorySelector: React.FC<LeaveCategorySelectorProps> = ({
  categories,
  currentCategory,
  onCategoryChange,
  leaveDates = [],
  rangeMode,
  onRangeModeChange,
  markMode,
  onMarkModeChange,
}) => {
  const activeCategories = categories.filter((category) => !category.isArchived);

  const getCategoryUsedDays = (categoryId: string) => {
    return leaveDates.filter((leaveDate) => leaveDate.categoryId === categoryId).length;
  };

  const sameWeekday = rangeMode === 'weekday';
  const rangeMarking = markMode === 'range';
  const [hint, setHint] = useState<{ text: string; x: number; y: number } | null>(null);
  const pressRef = useRef<{ timer: number; x: number; y: number } | null>(null);
  const ignoreClickUntilRef = useRef(0);
  const swallowReleaseRef = useRef(false);

  const cancelPress = () => {
    if (!pressRef.current) return;
    window.clearTimeout(pressRef.current.timer);
    pressRef.current = null;
  };

  const openHint = (text: string, x: number, y: number, swallowRelease: boolean) => {
    ignoreClickUntilRef.current = Date.now() + 500;
    swallowReleaseRef.current = swallowRelease;
    setHint({
      text,
      x: Math.max(8, Math.min(x, window.innerWidth - 228)),
      y: Math.max(8, Math.min(y, window.innerHeight - 72)),
    });
  };

  const hintHandlers = (text: string, onSelect: () => void) => ({
    title: text,
    onClick: () => {
      if (Date.now() < ignoreClickUntilRef.current) return;
      onSelect();
    },
    onContextMenu: (event: React.MouseEvent) => {
      event.preventDefault();
      cancelPress();
      openHint(text, event.clientX, event.clientY, false);
    },
    onPointerDown: (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      cancelPress();
      const x = event.clientX;
      const y = event.clientY;
      const timer = window.setTimeout(() => {
        pressRef.current = null;
        openHint(text, x, y, true);
      }, 450);
      pressRef.current = { timer, x, y };
    },
    onPointerMove: (event: React.PointerEvent) => {
      const press = pressRef.current;
      if (!press) return;
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10) cancelPress();
    },
    onPointerUp: cancelPress,
    onPointerCancel: cancelPress,
  });

  return (
    <div className="rounded-lg bg-white p-2 shadow">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
      {activeCategories.length === 0 ? (
        <p className="px-1 py-1 text-xs text-gray-500">No leave categories. Add one in the tools panel.</p>
      ) : (
        <>
          {activeCategories.map((category) => {
            const usedDays = getCategoryUsedDays(category.id);
            const isSelected = currentCategory?.id === category.id;
            const isQuotaExceeded = usedDays > category.quota;
            const isQuotaReached = usedDays === category.quota;

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => onCategoryChange(category)}
                className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-xs ${
                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                } ${isQuotaExceeded ? 'border-red-300 bg-red-50' : isQuotaReached ? 'border-orange-300 bg-orange-50' : ''}`}
                title={categoryHoverTitle(category, usedDays, isQuotaExceeded, isQuotaReached)}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                <span className="truncate font-medium text-gray-900">{category.name}</span>
                {category.projectId == null && (
                  <span className="shrink-0 rounded bg-gray-200 px-1 text-[10px] font-medium text-gray-700">All</span>
                )}
                <span className={`shrink-0 ${isQuotaExceeded ? 'font-semibold text-red-600' : isQuotaReached ? 'font-semibold text-orange-600' : 'text-gray-500'}`}>
                  {usedDays}/{category.quota}
                </span>
              </button>
            );
          })}
        </>
      )}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <span className="inline-flex rounded-md border border-gray-200 p-0.5" role="group" aria-label="Days included in a range">
            <button
              type="button"
              aria-pressed={!sameWeekday}
              aria-label="All weekdays in the range"
              className={`rounded p-1 ${!sameWeekday ? 'bg-blue-50 text-blue-700' : 'text-gray-400 hover:text-gray-600'}`}
              {...hintHandlers('Marks every weekday in the range.', () => onRangeModeChange('all'))}
            >
              <CalendarSpanIcon direction="horizontal" />
            </button>
            <button
              type="button"
              aria-pressed={sameWeekday}
              aria-label="Same weekday in the range"
              className={`rounded p-1 ${sameWeekday ? 'bg-blue-50 text-blue-700' : 'text-gray-400 hover:text-gray-600'}`}
              {...hintHandlers('Marks only that same weekday.', () => onRangeModeChange('weekday'))}
            >
              <CalendarSpanIcon direction="vertical" />
            </button>
          </span>
          <span className="inline-flex rounded-md border border-gray-200 p-0.5" role="group" aria-label="How to mark days">
            <button
              type="button"
              aria-pressed={!rangeMarking}
              aria-label="Click a day to mark or clear it"
              className={`rounded p-1 ${!rangeMarking ? 'bg-blue-50 text-blue-700' : 'text-gray-400 hover:text-gray-600'}`}
              {...hintHandlers('Click a day to mark it or clear it.', () => onMarkModeChange('single'))}
            >
              <ClickCountIcon clicks={1} />
            </button>
            <button
              type="button"
              aria-pressed={rangeMarking}
              aria-label="Tap a start day, then an end day"
              className={`rounded p-1 ${rangeMarking ? 'bg-blue-50 text-blue-700' : 'text-gray-400 hover:text-gray-600'}`}
              {...hintHandlers('Tap the start day, then the end day.', () => onMarkModeChange('range'))}
            >
              <ClickCountIcon clicks={2} />
            </button>
          </span>
        </div>
      </div>
      {hint &&
        createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default"
              aria-label="Close option description"
              onClick={() => {
                if (swallowReleaseRef.current) {
                  swallowReleaseRef.current = false;
                  return;
                }
                setHint(null);
              }}
            />
            <div
              role="menu"
              className="fixed z-50 max-w-56 rounded-md border border-gray-200 bg-white p-1 shadow-md"
              style={{ left: hint.x, top: hint.y }}
            >
              <div className="px-2 py-1.5 text-sm font-semibold text-gray-900" role="presentation">
                {hint.text}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
};

function CalendarSpanIcon({ direction }: { direction: 'horizontal' | 'vertical' }) {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
      <rect x="1.75" y="3" width="12.5" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <path d="M1.75 6.25h12.5M5 1.75v2.25M11 1.75v2.25" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      {direction === 'horizontal' ? (
        <path d="M3.5 10.25h9" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      ) : (
        <path d="M8 7.75v5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      )}
    </svg>
  );
}

function categoryHoverTitle(
  category: LeaveCategory,
  usedDays: number,
  isQuotaExceeded: boolean,
  isQuotaReached: boolean
): string {
  const expiry = category.endDate ? `Expires ${formatExpiry(category.endDate)}` : 'No expiry';
  if (isQuotaExceeded) return `${expiry} · Quota exceeded: ${usedDays}/${category.quota}`;
  if (isQuotaReached) return `${expiry} · Quota reached: ${usedDays}/${category.quota}`;
  return expiry;
}

function formatExpiry(endDate: string): string {
  const [year, month, day] = endDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function ClickCountIcon({ clicks }: { clicks: 1 | 2 }) {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
      <path d="M2.4 1.8l.15 7.4 2-1.9 1.55 3.3 1.35-.65-1.55-3.2 2.55-.15L2.4 1.8z" fill="currentColor" />
      {clicks === 1 ? (
        <circle cx="12.15" cy="12.15" r="2.15" fill="none" stroke="currentColor" strokeWidth="1.25" />
      ) : (
        <>
          <circle cx="9.9" cy="10.2" r="1.35" fill="none" stroke="currentColor" strokeWidth="1.15" />
          <circle cx="13.45" cy="13.35" r="1.35" fill="none" stroke="currentColor" strokeWidth="1.15" />
        </>
      )}
    </svg>
  );
}
