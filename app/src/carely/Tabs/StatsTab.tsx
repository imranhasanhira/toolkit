import React, { useState, useMemo } from 'react';
import { useQuery, getCarelyVitalLogs } from "wasp/client/operations";
import { MetricChip } from '../components/MetricChip';
import { StatChart } from '../components/StatChart';
import { StatSummaryTile } from '../components/StatSummaryTile';

import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

export function StatsTab({ parent }: { parent: any }) {
  const [metric, setMetric] = useState('BLOOD_PRESSURE');
  const [period, setPeriod] = useState('month');
  const [endOffsetDays, setEndOffsetDays] = useState(0);
  
  const { data: logs, isLoading, refetch } = useQuery(getCarelyVitalLogs, { parentId: parent.id, type: metric });

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
    
    return filtered.map(l => {
      const date = new Date(l.loggedAt);
      const isBP = l.type === 'BLOOD_PRESSURE';
      return {
        timestamp: date.getTime(),
        val: isBP ? undefined : (l.value as any).value,
        systolic: isBP ? (l.value as any).systolic : undefined,
        diastolic: isBP ? (l.value as any).diastolic : undefined,
      };
    });
  }, [logs, range.start, range.end]);

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
    if (type === 'BLOOD_PRESSURE') return 'mmHg';
    if (type === 'GLUCOSE') return 'mg/dL';
    if (type === 'TEMPERATURE') return `°${parent.temperatureUnit === 'C' ? 'C' : 'F'}`;
    if (type === 'SPO2') return '%';
    if (type === 'HEART_RATE') return 'bpm';
    return '';
  };
  const unit = getUnit(metric);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 lg:pb-0">
      <div>
        <h2 className="font-lexend font-bold text-[color:var(--color-carely-on-surface)] text-xl mb-4">Health Trends</h2>
        
        <div className="flex gap-2 bg-[color:var(--color-carely-surface-lowest)] p-1.5 rounded-xl border border-[color:var(--color-carely-surface-high)] overflow-x-auto no-scrollbar">
          {['BLOOD_PRESSURE', 'GLUCOSE', 'TEMPERATURE', 'SPO2', 'HEART_RATE'].map(m => (
            <MetricChip key={m} label={m.replace('_', ' ')} selected={metric === m} onClick={() => setMetric(m)} />
          ))}
        </div>
      </div>

      <div className="bg-[color:var(--color-carely-surface-lowest)] p-4 sm:p-5 rounded-2xl border border-[color:var(--color-carely-surface-high)] shadow-xs overflow-hidden">
        <div className="flex flex-col mb-4 gap-3">
           <h3 className="font-lexend font-semibold text-[color:var(--color-carely-on-surface)] shrink-0">{metric.replace('_', ' ')} Chart</h3>
           
             <div className="overflow-x-auto no-scrollbar pb-1">
               <div className="flex items-center gap-2 min-w-max">
                 <div className="flex gap-1 bg-[color:var(--color-carely-surface-high)] p-1 rounded-lg shrink-0">
                   <button onClick={() => handlePeriodChange('week')} className={`px-3 py-1 rounded text-xs font-jakarta font-medium transition-colors ${period==='week'?'bg-[color:var(--color-carely-surface-lowest)] shadow-xs text-[color:var(--color-carely-primary)]':'text-[color:var(--color-carely-on-surface-variant)]'}`}>1W</button>
                   <button onClick={() => handlePeriodChange('month')} className={`px-3 py-1 rounded text-xs font-jakarta font-medium transition-colors ${period==='month'?'bg-[color:var(--color-carely-surface-lowest)] shadow-xs text-[color:var(--color-carely-primary)]':'text-[color:var(--color-carely-on-surface-variant)]'}`}>1M</button>
                 </div>
                 
                 <div className="flex bg-[color:var(--color-carely-surface-lowest)] border border-[color:var(--color-carely-surface-high)] rounded-lg overflow-hidden shadow-xs shrink-0">
                   <button onClick={handlePrev} className="px-2 py-1 text-[color:var(--color-carely-on-surface-variant)] hover:bg-[color:var(--color-carely-surface-low)] transition-colors border-r border-[color:var(--color-carely-surface-high)]"><ChevronLeft className="w-4 h-4" /></button>
                   <button onClick={handleNext} disabled={endOffsetDays === 0} className="px-2 py-1 text-[color:var(--color-carely-on-surface-variant)] hover:bg-[color:var(--color-carely-surface-low)] disabled:opacity-30 transition-colors"><ChevronRight className="w-4 h-4" /></button>
                 </div>
                 
                 <button onClick={() => refetch()} className="p-1.5 bg-[color:var(--color-carely-surface-lowest)] border border-[color:var(--color-carely-surface-high)] rounded-lg text-[color:var(--color-carely-on-surface-variant)] hover:bg-[color:var(--color-carely-surface-low)] hover:text-[color:var(--color-carely-primary)] transition-colors shadow-xs shrink-0" title="Refresh Data">
                   <RefreshCw className="w-4 h-4" />
                 </button>

                 <p className="text-sm font-jakarta text-[color:var(--color-carely-on-surface-variant)] shrink-0 ml-2 whitespace-nowrap">{dateLabel}</p>
               </div>
             </div>
        </div>
        
        {isLoading ? (
          <div className="h-48 flex items-center justify-center font-jakarta text-[color:var(--color-carely-on-surface-variant)]">Loading data...</div>
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
        <StatSummaryTile title="Avg" value={String(stats.avg)} unit={unit} />
        <StatSummaryTile title="High" value={String(stats.max)} unit={unit} />
        <StatSummaryTile title="Low" value={String(stats.min)} unit={unit} />
      </div>
    </div>
  );
}
