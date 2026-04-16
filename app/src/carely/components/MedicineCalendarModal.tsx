import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

function buildMonthGrid(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const arr: { date: Date; inMonth: boolean }[] = [];

  for (let i = 0; i < firstDay.getDay(); i++) {
    const d = new Date(firstDay);
    d.setDate(firstDay.getDate() - (firstDay.getDay() - i));
    arr.push({ date: d, inMonth: false });
  }
  for (let i = 1; i <= lastDay.getDate(); i++) {
    arr.push({ date: new Date(year, month, i), inMonth: true });
  }
  const remainder = arr.length % 7;
  if (remainder > 0) {
    for (let i = 1; i <= 7 - remainder; i++) {
      const d = new Date(lastDay);
      d.setDate(lastDay.getDate() + i);
      arr.push({ date: d, inMonth: false });
    }
  }
  return arr;
}

export function MedicineCalendarModal({
  parentId,
  activeOffset,
  onDateSelect,
  onClose,
  navHeight,
  getStatusForDate,
  renderStatusDot,
}: {
  parentId: string;
  activeOffset: number;
  onDateSelect: (offset: number) => void;
  onClose: () => void;
  navHeight: number;
  getStatusForDate: (epochMs: number) => string;
  renderStatusDot: (status: string) => React.ReactNode;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month

  const targetMonth = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
    return d;
  }, [monthOffset]);

  const grid = useMemo(
    () => buildMonthGrid(targetMonth.getFullYear(), targetMonth.getMonth()),
    [targetMonth]
  );

  const toOffset = (d: Date) =>
    Math.round((today.getTime() - d.getTime()) / 86400000);

  // Strip height ≈ 72px (3 rows of content + padding)
  const STRIP_HEIGHT = 72;

  // The modal bottom edge sits right at top of the week strip
  const modalBottom = navHeight + STRIP_HEIGHT;

  return (
    <>
      {/* Dimmer */}
      <div
        className="fixed inset-0 z-40 bg-black/30 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Calendar panel – slides up from above the week strip */}
      <div
        style={{ bottom: `${modalBottom}px` }}
        className="fixed left-0 right-0 z-50 lg:left-64
                   bg-[color:var(--color-carely-surface-lowest)]
                   border border-[color:var(--color-carely-surface-high)]
                   rounded-t-3xl shadow-[0_-8px_40px_rgba(0,0,0,0.12)]
                   animate-in slide-in-from-bottom-4 duration-300"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMonthOffset(o => o + 1)}
              className="p-1.5 rounded-lg bg-[color:var(--color-carely-surface-low)]
                         hover:bg-[color:var(--color-carely-surface-high)] transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-[color:var(--color-carely-on-surface)]" />
            </button>

            <h3 className="font-lexend font-bold text-[color:var(--color-carely-on-surface)] text-base">
              {targetMonth.toLocaleDateString([], { month: 'long', year: 'numeric' })}
            </h3>

            <button
              onClick={() => setMonthOffset(o => Math.max(0, o - 1))}
              disabled={monthOffset === 0}
              className="p-1.5 rounded-lg bg-[color:var(--color-carely-surface-low)]
                         hover:bg-[color:var(--color-carely-surface-high)] transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4 text-[color:var(--color-carely-on-surface)]" />
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-[color:var(--color-carely-surface-low)]
                       hover:bg-[color:var(--color-carely-surface-high)] transition-colors"
            aria-label="Close calendar"
          >
            <X className="w-4 h-4 text-[color:var(--color-carely-on-surface-variant)]" />
          </button>
        </div>

        {/* Weekday header row */}
        <div className="grid grid-cols-7 px-4 mb-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(w => (
            <div key={w} className="text-center text-[10px] font-jakarta font-semibold uppercase
                                    text-[color:var(--color-carely-on-surface-variant)] py-1">
              {w}
            </div>
          ))}
        </div>

        {/* Date grid */}
        <div className="grid grid-cols-7 gap-1 px-4 pb-5">
          {grid.map((item, i) => {
            const offset = toOffset(item.date);
            const isSelected = activeOffset === offset;
            const status = getStatusForDate(item.date.getTime());

            return (
              <button
                key={i}
                onClick={() => onDateSelect(offset)}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl transition-colors
                  ${!item.inMonth ? 'opacity-25' : ''}
                  ${isSelected
                    ? 'bg-[color:var(--color-carely-primary)]/15 ring-1 ring-[color:var(--color-carely-primary)]'
                    : 'hover:bg-[color:var(--color-carely-surface-low)]'
                  }`}
              >
                <span
                  className={`text-sm font-lexend font-bold leading-none
                    ${isSelected
                      ? 'text-[color:var(--color-carely-primary)]'
                      : 'text-[color:var(--color-carely-on-surface)]'
                    }`}
                >
                  {item.date.getDate()}
                </span>
                <div className="h-3.5 flex items-center justify-center">
                  {renderStatusDot(status)}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-4 pb-4 px-4 text-[10px] font-jakarta
                        text-[color:var(--color-carely-on-surface-variant)] font-medium">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full border border-[color:var(--color-carely-on-surface-variant)] opacity-40 inline-block" />
            None scheduled
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#106A6A] inline-block" />
            Complete
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            Partial
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#FA746F] inline-block" />
            Missed
          </span>
        </div>
      </div>
    </>
  );
}
