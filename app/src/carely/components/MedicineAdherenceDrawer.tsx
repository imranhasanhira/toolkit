import React, { useState, useMemo } from 'react';
import { useQuery, getCarelyPrescriptions, getCarelyMedicineLogsByRange } from "wasp/client/operations";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const WEEKDAY_SHORT_KEYS = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'] as const;

function toLocalDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function MedicineAdherenceDrawer({ parentId, onDateSelect, activeOffset }: { parentId: string, onDateSelect: (offset: number) => void, activeOffset: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0); 
  const [navHeight, setNavHeight] = useState(0);
  const { t } = useTranslation('carely');

  React.useEffect(() => {
    const checkHeight = () => {
      if (window.innerWidth >= 1024) { 
        setNavHeight(0);
        return;
      }
      setTimeout(() => {
        const el = document.getElementById('carely-bottom-tab-bar');
        if (el) {
          setNavHeight(el.getBoundingClientRect().height);
        }
      }, 50);
    };
    checkHeight();
    window.addEventListener('resize', checkHeight);
    return () => window.removeEventListener('resize', checkHeight);
  }, []);
  
  const range = useMemo(() => {
    const today = new Date();
    // monthOffset 0 = this month, 1 = last month
    const targetMonthDate = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
    
    const start = new Date(targetMonthDate);
    start.setDate(1);
    start.setDate(start.getDate() - 14); // Buffer
    
    const end = new Date(targetMonthDate);
    end.setMonth(end.getMonth() + 1);
    end.setDate(14); // Buffer
    
    return { start, end, targetMonthDate };
  }, [monthOffset]);

  const { data: prescriptions } = useQuery(getCarelyPrescriptions, { parentId });
  const { data: logs } = useQuery(getCarelyMedicineLogsByRange, { parentId, startDate: range.start, endDate: range.end });

  const getStatusForDate = (epochMs: number) => {
    const d = new Date(epochMs);
    d.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    if (!prescriptions || !logs) return 'LOADING';

    // 1. Find active prescriptions for this date -> calculate required slots
    const activeRx = prescriptions.filter((rx: any) => {
      const start = new Date(rx.startDate); start.setHours(0,0,0,0);
      const end = rx.endDate ? new Date(rx.endDate) : null;
      if (end) end.setHours(23,59,59,999);
      
      return d >= start && (!end || d <= end);
    });

    let totalSlots = 0;
    activeRx.forEach((rx: any) => {
      const s = rx.doseSchedule;
      if (s.type === 'custom') totalSlots += 1;
      else {
        if (s.morning > 0) totalSlots++;
        if (s.afternoon > 0) totalSlots++;
        if (s.evening > 0) totalSlots++;
        if (s.night > 0) totalSlots++;
      }
    });

    if (totalSlots === 0) return 'EMPTY'; // Not prescribed anything

    const strDate = toLocalDateKey(d);
    const dateLogs = logs.filter((l: any) => toLocalDateKey(new Date(l.intakeDate)) === strDate);
    
    const completed = dateLogs.length;

    if (completed >= totalSlots) return 'TICK';
    if (completed > 0) return 'DOT';
    
    if (d > today) return 'FUTURE';
    return 'CROSS';
  };

  const today = new Date();
  today.setHours(0,0,0,0);

  // Generate the days for the collapsed state: trailing 7 days
  const collapsedDays = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      arr.push(d);
    }
    return arr;
  }, [today.getTime()]);

  // Generate month grid
  const monthGrid = useMemo(() => {
    const month = range.targetMonthDate.getMonth();
    const year = range.targetMonthDate.getFullYear();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const arr: { date: Date, inMonth: boolean }[] = [];
    // Prefix padding
    for (let i = 0; i < firstDay.getDay(); i++) {
       const d = new Date(firstDay);
       d.setDate(d.getDate() - (firstDay.getDay() - i));
       arr.push({ date: d, inMonth: false });
    }
    // Days
    for (let i = 1; i <= lastDay.getDate(); i++) {
       arr.push({ date: new Date(year, month, i), inMonth: true });
    }
    // Suffix padding
    const remainder = arr.length % 7;
    if (remainder > 0) {
      for (let i = 1; i <= 7 - remainder; i++) {
         const d = new Date(lastDay);
         d.setDate(d.getDate() + i);
         arr.push({ date: d, inMonth: false });
      }
    }
    return arr;
  }, [range.targetMonthDate]);

  const renderStatusIcon = (status: string) => {
    if (status === 'LOADING') return <div className="w-1 h-1 bg-[color:var(--color-carely-surface-high)] rounded-full animate-pulse" />;
    if (status === 'EMPTY') return <div className="w-2 h-2 rounded-full border border-[color:var(--color-carely-on-surface-variant)] opacity-30" />;
    if (status === 'FUTURE') return <div className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-carely-surface-high)]" />;
    if (status === 'TICK') return <div className="bg-[#106A6A] p-0.5 rounded-full"><Check className="w-3 h-3 text-white" strokeWidth={3} /></div>;
    if (status === 'DOT') return <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />;
    if (status === 'CROSS') return <div className="bg-[#FA746F] p-0.5 rounded-full"><X className="w-3 h-3 text-white" strokeWidth={3} /></div>;
    return null;
  };

  const handleDayClick = (d: Date) => {
    // offset is (today - d) in days
    const diffTime = today.getTime() - d.getTime();
    const offset = Math.round(diffTime / (1000 * 60 * 60 * 24));
    onDateSelect(offset);
  };

  return (
    <>
      {/* Drawer Overlay (dimmer) */}
      {isExpanded && (
        <div className="fixed inset-0 z-40 bg-black/20 animate-in fade-in" onClick={() => setIsExpanded(false)} />
      )}
      
      {/* The Drawer Surface */}
      <div 
        style={{ bottom: navHeight ? `${navHeight}px` : '0px' }}
        className={`fixed left-0 right-0 z-[60] bg-[color:var(--color-carely-surface-lowest)] border-t border-x border-[color:var(--color-carely-surface-high)] shadow-[0_-8px_30px_rgba(0,0,0,0.08)] lg:rounded-t-3xl transition-all duration-500 ease-out flex flex-col ${isExpanded ? 'h-[440px]' : 'h-[100px]'} lg:left-64 lg:bottom-0`}
      >
        
        {/* Grip Handle */}
        <div className="w-full h-8 flex items-center justify-center cursor-pointer hover:bg-[color:var(--color-carely-surface-low)] transition-colors rounded-t-3xl" onClick={() => setIsExpanded(!isExpanded)}>
           <div className="w-12 h-1.5 bg-[color:var(--color-carely-surface-high)] rounded-full flex items-center justify-center relative">
              {isExpanded ? <ChevronDown className="w-4 h-4 text-[color:var(--color-carely-on-surface-variant)] absolute" /> : <ChevronUp className="w-4 h-4 text-[color:var(--color-carely-on-surface-variant)] absolute" />}
           </div>
        </div>

        <div className="px-5 pb-5 flex-1 relative flex flex-col overflow-hidden">
          
          {/* Collapsed Content */}
          <div className={`flex w-full justify-between items-center transition-all duration-300 absolute left-0 px-5 ${isExpanded ? 'opacity-0 pointer-events-none translate-y-4' : 'opacity-100 translate-y-0 text-center top-8'}`}>
            {collapsedDays.map((d, i) => {
               const status = getStatusForDate(d.getTime());
               const diffTime = today.getTime() - d.getTime();
               const isSelectedOffset = activeOffset === Math.round(diffTime / (1000 * 60 * 60 * 24));
               
               return (
                 <div key={i} onClick={() => handleDayClick(d)} className={`flex flex-col items-center gap-2 cursor-pointer p-2 rounded-xl transition-all ${isSelectedOffset ? 'bg-[color:var(--color-carely-primary)]/10' : 'hover:bg-[color:var(--color-carely-surface-low)]'}`}>
                   <span className={`text-xs font-jakarta ${isSelectedOffset ? 'text-[color:var(--color-carely-primary)] font-bold' : 'text-[color:var(--color-carely-on-surface-variant)]'}`}>{d.toLocaleDateString([],{weekday:'short'})}</span>
                   <div className="flex w-6 h-6 items-center justify-center">
                     {renderStatusIcon(status)}
                   </div>
                 </div>
               );
            })}
          </div>

          {/* Expanded Content */}
          <div className={`flex flex-col flex-1 transition-all duration-500 absolute top-8 left-0 right-0 px-5 ${isExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 pointer-events-none translate-y-12'}`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-lexend font-bold text-[color:var(--color-carely-on-surface)] text-lg">
                {range.targetMonthDate.toLocaleDateString([], { month: 'long', year: 'numeric' })}
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setMonthOffset(o => o + 1)} className="p-1.5 bg-[color:var(--color-carely-surface-low)] rounded-lg hover:bg-[color:var(--color-carely-surface-high)] transition-colors"><ChevronLeft className="w-5 h-5 text-[color:var(--color-carely-on-surface)]" /></button>
                <button onClick={() => setMonthOffset(o => Math.max(0, o - 1))} className="p-1.5 bg-[color:var(--color-carely-surface-low)] rounded-lg hover:bg-[color:var(--color-carely-surface-high)] transition-colors" disabled={monthOffset === 0}><ChevronRight className={`w-5 h-5 ${monthOffset === 0 ? 'text-[color:var(--color-carely-on-surface-variant)] opacity-50' : 'text-[color:var(--color-carely-on-surface)]'}`} /></button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-y-4 gap-x-2 text-center text-xs font-jakarta mb-2 text-[color:var(--color-carely-on-surface-variant)] uppercase font-semibold">
              {WEEKDAY_SHORT_KEYS.map(w => <div key={w}>{t(`calendar.weekdayShort.${w}`)}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-y-2 gap-x-2">
              {monthGrid.map((item, i) => {
                const status = getStatusForDate(item.date.getTime());
                const diffTime = today.getTime() - item.date.getTime();
                const isSelectedOffset = activeOffset === Math.round(diffTime / (1000 * 60 * 60 * 24));
                
                return (
                  <div key={i} onClick={() => handleDayClick(item.date)} className={`flex flex-col items-center justify-center p-2 rounded-xl cursor-pointer transition-colors min-h-[50px] ${!item.inMonth ? 'opacity-30' : ''} ${isSelectedOffset ? 'bg-[color:var(--color-carely-primary)]/10 ring-1 ring-[color:var(--color-carely-primary)]' : 'hover:bg-[color:var(--color-carely-surface-low)]'}`}>
                    <span className={`text-sm font-lexend mb-1 ${isSelectedOffset ? 'text-[color:var(--color-carely-primary)] font-bold' : 'text-[color:var(--color-carely-on-surface)]'}`}>{item.date.getDate()}</span>
                    <div className="flex items-center justify-center w-5 h-5">
                      {renderStatusIcon(status)}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-auto flex justify-center gap-4 text-[10px] font-jakarta text-[color:var(--color-carely-on-surface-variant)] font-medium pt-4">
               <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full border border-[color:var(--color-carely-on-surface-variant)] opacity-30" /> {t('calendar.legend.noneActive')}</div>
               <div className="flex items-center gap-1"><Check className="w-3 h-3 text-[#106A6A]" /> {t('calendar.legend.allClear')}</div>
               <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400" /> {t('calendar.legend.partial')}</div>
               <div className="flex items-center gap-1"><X className="w-3 h-3 text-[#FA746F]" /> {t('calendar.legend.skipped')}</div>
            </div>
          </div>
          
        </div>
      </div>
    </>
  );
}
