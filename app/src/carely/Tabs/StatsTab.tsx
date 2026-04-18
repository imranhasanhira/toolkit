import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, getCarelyAppSettings, getCarelyVitalLogs, getCarelyVitalCategories } from "wasp/client/operations";
import { useTranslation } from 'react-i18next';
import { MetricChip } from '../components/MetricChip';
import { StatChart } from '../components/StatChart';
import { StatSummaryTile } from '../components/StatSummaryTile';

import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

export function StatsTab({ parent }: { parent: any }) {
  const { t } = useTranslation('carely');
  const [metric, setMetric] = useState('BLOOD_PRESSURE');
  const [period, setPeriod] = useState('month');
  const [endOffsetDays, setEndOffsetDays] = useState(0);
  const [medianPerDay, setMedianPerDay] = useState(false);
  
  const { data: logs, isLoading, refetch } = useQuery(getCarelyVitalLogs, { parentId: parent.id, type: metric });
  const { data: categories } = useQuery(getCarelyVitalCategories);
  const { data: appSettings } = useQuery(getCarelyAppSettings);

  const activeCategories = useMemo(() => {
    const list = (categories ?? []).filter((c: any) => c.isActive !== false);
    return list.sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [categories]);

  const categoryByKey = useMemo(() => {
    const map: Record<string, any> = {};
    for (const c of activeCategories) map[c.key] = c;
    return map;
  }, [activeCategories]);

  useEffect(() => {
    if (activeCategories.length === 0) return;
    if (!categoryByKey[metric]) setMetric(activeCategories[0].key);
  }, [activeCategories, categoryByKey, metric]);

  const toLocalDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getNumericValueForMedian = (l: any) => {
    const kind = categoryByKey[l.type]?.kind;
    if (kind === 'blood_pressure' || l.type === 'BLOOD_PRESSURE') {
      const sys = Number((l.value as any)?.systolic);
      const dia = Number((l.value as any)?.diastolic);
      if (!Number.isFinite(sys) || !Number.isFinite(dia)) return Number.NaN;
      // Mean arterial pressure (MAP) is a good scalar for BP comparisons.
      return dia + (sys - dia) / 3;
    }
    const v = Number((l.value as any)?.value);
    return Number.isFinite(v) ? v : Number.NaN;
  };

  const range = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const end = new Date(today);
    end.setDate(end.getDate() - endOffsetDays);
    end.setHours(23, 59, 59, 999);

    const start = new Date(end);
    const days = period === 'week' ? 6 : 29; // 7-day or 30-day window
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    return { start, end };
  }, [period, endOffsetDays]);

  const chartData = useMemo(() => {
    if (!logs) return [];
    
    // Sort oldest to newest
    const sorted = [...logs].sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime());

    const filtered = sorted.filter(l => {
      const d = new Date(l.loggedAt);
      return d >= range.start && d <= range.end;
    });

    const selected = (() => {
      if (!medianPerDay) return filtered;

      // If there are multiple entries on the same day, keep only one:
      // pick the median entry (by value; BP uses MAP, others use value.value).
      const byDay = new Map<string, any[]>();
      for (const l of filtered) {
        const key = toLocalDateKey(new Date(l.loggedAt));
        const arr = byDay.get(key);
        if (arr) arr.push(l);
        else byDay.set(key, [l]);
      }

      const onePerDay: any[] = [];
      for (const dayLogs of byDay.values()) {
        if (dayLogs.length === 1) {
          onePerDay.push(dayLogs[0]);
          continue;
        }
        const withVal = dayLogs
          .map((l) => ({ l, v: getNumericValueForMedian(l) }))
          .filter((x) => Number.isFinite(x.v));

        if (withVal.length === 0) {
          // Fallback: pick the chronologically middle entry.
          const chrono = [...dayLogs].sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime());
          onePerDay.push(chrono[Math.floor(chrono.length / 2)]);
          continue;
        }

        withVal.sort((a, b) => a.v - b.v);
        onePerDay.push(withVal[Math.floor(withVal.length / 2)].l);
      }

      onePerDay.sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime());
      return onePerDay;
    })();

    return selected.map(l => {
      const date = new Date(l.loggedAt);
      const isBP = (categoryByKey[l.type]?.kind === 'blood_pressure') || l.type === 'BLOOD_PRESSURE';
      return {
        timestamp: date.getTime(),
        val: isBP ? undefined : (l.value as any).value,
        systolic: isBP ? (l.value as any).systolic : undefined,
        diastolic: isBP ? (l.value as any).diastolic : undefined,
      };
    });
  }, [logs, range.start, range.end, medianPerDay, categoryByKey]);

  const handlePrev = () => {
    setEndOffsetDays(o => o + (period === 'week' ? 7 : 30));
  };
  
  const handleNext = () => {
    setEndOffsetDays(o => Math.max(0, o - (period === 'week' ? 7 : 30)));
  };

  const handleNudge = (dir: number) => {
    const stepDays = period === 'week' ? 1 : 7;
    setEndOffsetDays(o => Math.max(0, o + (dir > 0 ? stepDays : -stepDays)));
  };
  
  const handlePeriodChange = (p: string) => {
    setPeriod(p);
    setEndOffsetDays(0);
  };

  const dateLabel = useMemo(() => {
    const start = range.start;
    const end = range.end;
    const sMonth = start.toLocaleDateString([], { month: 'short' });
    const eMonth = end.toLocaleDateString([], { month: 'short' });
    const sDate = start.getDate();
    const eDate = end.getDate();
    return `${sMonth} ${sDate} - ${eMonth} ${eDate}`;
  }, [range.start, range.end]);

  // Calc averages
  const stats = useMemo(() => {
    if (!chartData || chartData.length === 0) return { avg: '-', min: '-', max: '-' };
    if (metric === 'BLOOD_PRESSURE') {
       const sys = chartData.map(d => d.systolic || 0);
       const dia = chartData.map(d => d.diastolic || 0);
       return {
         avg: `${Math.round(sys.reduce((a,b)=>a+b,0)/sys.length)}/${Math.round(dia.reduce((a,b)=>a+b,0)/dia.length)}`,
         min: `${Math.min(...sys)}/${Math.min(...dia)}`,
         max: `${Math.max(...sys)}/${Math.max(...dia)}`
       };
    } else {
       const vals = chartData.map(d => d.val || 0);
       return {
         avg: Math.round(vals.reduce((a,b)=>a+b,0)/vals.length * 10) / 10,
         min: Math.min(...vals),
         max: Math.max(...vals)
       };
    }
  }, [chartData, metric]);

  const getUnit = (type: string) => {
    if (type === 'TEMPERATURE') return `°${((appSettings as any)?.temperatureUnit === 'C' ? 'C' : 'F')}`;
    const cat = categoryByKey[type];
    return cat?.unit || '';
  };
  const unit = getUnit(metric);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 lg:pb-0">
      <div>
        <h2 className="font-lexend font-bold text-[color:var(--color-carely-on-surface)] text-xl mb-4">{t('stats.title')}</h2>
        
        <div className="flex gap-2 bg-[color:var(--color-carely-surface-lowest)] p-1.5 rounded-xl border border-[color:var(--color-carely-surface-high)] overflow-x-auto no-scrollbar">
          {activeCategories.map((c: any) => (
            <MetricChip key={c.key} label={c.displayName} selected={metric === c.key} onClick={() => setMetric(c.key)} />
          ))}
        </div>
      </div>

      <div className="bg-[color:var(--color-carely-surface-lowest)] p-4 sm:p-5 rounded-2xl border border-[color:var(--color-carely-surface-high)] shadow-xs overflow-hidden">
        <div className="flex flex-col mb-4 gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-lexend font-semibold text-[color:var(--color-carely-on-surface)] shrink-0">
              {(categoryByKey[metric]?.displayName ?? metric.replace('_', ' '))} {t('stats.chart.suffix')}
            </h3>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setMedianPerDay((v) => !v)}
                aria-pressed={medianPerDay}
                title={medianPerDay ? t('stats.chart.medianEnabled') : t('stats.chart.medianDisabled')}
                className={[
                  "p-1.5 border rounded-lg transition-colors shadow-xs",
                  medianPerDay
                    ? "bg-[color:var(--color-carely-primary)]/10 text-[color:var(--color-carely-primary)] border-[color:var(--color-carely-primary)]/30 hover:bg-[color:var(--color-carely-primary)]/15"
                    : "bg-[color:var(--color-carely-surface-lowest)] text-[color:var(--color-carely-on-surface-variant)] border-[color:var(--color-carely-surface-high)] hover:bg-[color:var(--color-carely-surface-low)]",
                ].join(" ")}
              >
                <span className="sr-only">
                  {medianPerDay ? t('stats.chart.medianSrOn') : t('stats.chart.medianSrOff')}
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path d="M3 4.25H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M4.5 8H11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M6 11.75H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>

              <button
                onClick={() => refetch()}
                className="p-1.5 bg-[color:var(--color-carely-surface-lowest)] border border-[color:var(--color-carely-surface-high)] rounded-lg text-[color:var(--color-carely-on-surface-variant)] hover:bg-[color:var(--color-carely-surface-low)] hover:text-[color:var(--color-carely-primary)] transition-colors shadow-xs"
                title={t('stats.chart.refresh')}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
           
             <div className="overflow-x-auto no-scrollbar pb-1">
               <div className="flex items-center gap-2 min-w-max">
                 <div className="flex gap-1 bg-[color:var(--color-carely-surface-high)] p-1 rounded-lg shrink-0">
                   <button onClick={() => handlePeriodChange('week')} className={`px-3 py-1 rounded text-xs font-jakarta font-medium transition-colors ${period==='week'?'bg-[color:var(--color-carely-surface-lowest)] shadow-xs text-[color:var(--color-carely-primary)]':'text-[color:var(--color-carely-on-surface-variant)]'}`}>{t('stats.chart.weekShort')}</button>
                   <button onClick={() => handlePeriodChange('month')} className={`px-3 py-1 rounded text-xs font-jakarta font-medium transition-colors ${period==='month'?'bg-[color:var(--color-carely-surface-lowest)] shadow-xs text-[color:var(--color-carely-primary)]':'text-[color:var(--color-carely-on-surface-variant)]'}`}>{t('stats.chart.monthShort')}</button>
                 </div>
                 
                 <div className="flex bg-[color:var(--color-carely-surface-lowest)] border border-[color:var(--color-carely-surface-high)] rounded-lg overflow-hidden shadow-xs shrink-0">
                   <button onClick={handlePrev} className="px-2 py-1 text-[color:var(--color-carely-on-surface-variant)] hover:bg-[color:var(--color-carely-surface-low)] transition-colors border-r border-[color:var(--color-carely-surface-high)]"><ChevronLeft className="w-4 h-4" /></button>
                   <button onClick={handleNext} disabled={endOffsetDays === 0} className="px-2 py-1 text-[color:var(--color-carely-on-surface-variant)] hover:bg-[color:var(--color-carely-surface-low)] disabled:opacity-30 transition-colors"><ChevronRight className="w-4 h-4" /></button>
                 </div>

                 <p className="text-sm font-jakarta text-[color:var(--color-carely-on-surface-variant)] shrink-0 ml-2 whitespace-nowrap">{dateLabel}</p>
               </div>
             </div>
        </div>
        
        {isLoading ? (
          <div className="h-48 flex items-center justify-center font-jakarta text-[color:var(--color-carely-on-surface-variant)]">{t('stats.chart.loading')}</div>
        ) : (
          <StatChart
            data={chartData}
            type={metric}
            onNudge={handleNudge}
            disableNudgeRight={endOffsetDays === 0}
          />
        )}
      </div>

      <div className="flex gap-2 sm:gap-3">
        <StatSummaryTile title={t('stats.summary.avg')} value={String(stats.avg)} unit={unit} />
        <StatSummaryTile title={t('stats.summary.high')} value={String(stats.max)} unit={unit} />
        <StatSummaryTile title={t('stats.summary.low')} value={String(stats.min)} unit={unit} />
      </div>
    </div>
  );
}
