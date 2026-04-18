import React, { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MedicineCalendarModal } from './MedicineCalendarModal';

function buildWeekDays(): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d;
  });
}

const WEEKDAY_SHORT_KEYS = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'] as const;

export function MedicineWeekStrip({
  parentId,
  activeOffset,
  onDateSelect,
  getStatusForDate,
  renderStatusDot,
}: {
  parentId: string;
  activeOffset: number;
  onDateSelect: (offset: number) => void;
  getStatusForDate: (epochMs: number) => string;
  renderStatusDot: (status: string) => React.ReactNode;
}) {
  const [navHeight, setNavHeight] = useState(0);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { t } = useTranslation('carely');

  // Measure the bottom nav bar height so we can sit exactly on top of it
  useEffect(() => {
    const measure = () => {
      const el = document.getElementById('carely-bottom-tab-bar');
      if (el && window.innerWidth < 1024) {
        setNavHeight(el.getBoundingClientRect().height);
      } else {
        setNavHeight(0);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekDays = buildWeekDays();

  const toOffset = (d: Date) =>
    Math.round((today.getTime() - d.getTime()) / 86400000);

  return (
    <>
      {/* ── Compact week strip ─────────────────────────────────── */}
      <div
        style={{ bottom: navHeight > 0 ? `${navHeight}px` : '0px' }}
        className="fixed left-0 right-0 z-40 lg:left-64 lg:bottom-0 lg:hidden
                   bg-[color:var(--color-carely-surface-lowest)]
                   border-t border-[color:var(--color-carely-surface-high)]
                   shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
      >
        <div className="flex items-stretch">
          {/* 7-day grid */}
          <div className="flex-1 grid grid-cols-7 px-1 py-2 gap-0">
            {weekDays.map((d, i) => {
              const offset = toOffset(d);
              const isSelected = activeOffset === offset;
              const status = getStatusForDate(d.getTime());

              return (
                <button
                  key={i}
                  onClick={() => onDateSelect(offset)}
                  className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl transition-colors
                    ${isSelected
                      ? 'bg-[color:var(--color-carely-primary)]/10'
                      : 'hover:bg-[color:var(--color-carely-surface-low)]'
                    }`}
                >
                  {/* Row 1 – weekday */}
                  <span
                    className={`text-[10px] font-jakarta font-semibold leading-none
                      ${isSelected
                        ? 'text-[color:var(--color-carely-primary)]'
                        : 'text-[color:var(--color-carely-on-surface-variant)]'
                      }`}
                  >
                    {t(`calendar.weekdayShort.${WEEKDAY_SHORT_KEYS[d.getDay()]}`)}
                  </span>

                  {/* Row 2 – date number */}
                  <span
                    className={`text-xs font-lexend font-bold leading-none
                      ${isSelected
                        ? 'text-[color:var(--color-carely-primary)]'
                        : 'text-[color:var(--color-carely-on-surface)]'
                      }`}
                  >
                    {d.getDate()}
                  </span>

                  {/* Row 3 – status dot */}
                  <div className="h-4 flex items-center justify-center">
                    {renderStatusDot(status)}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Arrow button – opens full calendar */}
          <button
            onClick={() => setCalendarOpen(true)}
            className="flex items-center justify-center px-3 border-l border-[color:var(--color-carely-surface-high)]
                       text-[color:var(--color-carely-on-surface-variant)]
                       hover:bg-[color:var(--color-carely-surface-low)] transition-colors"
            aria-label={t('calendar.open')}
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Full calendar modal ────────────────────────────────── */}
      {calendarOpen && (
        <MedicineCalendarModal
          parentId={parentId}
          activeOffset={activeOffset}
          onDateSelect={(offset) => {
            onDateSelect(offset);
            setCalendarOpen(false);
          }}
          onClose={() => setCalendarOpen(false)}
          navHeight={navHeight}
          getStatusForDate={getStatusForDate}
          renderStatusDot={renderStatusDot}
        />
      )}
    </>
  );
}
