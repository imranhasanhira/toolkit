import React from 'react';
import Chart from 'react-apexcharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function NudgeButton({
  direction,
  onClick,
  disabled,
}: {
  direction: 'left' | 'right';
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`pointer-events-auto w-11 h-11 rounded-2xl flex items-center justify-center bg-[color:var(--color-carely-surface-low)] text-[color:var(--color-carely-on-surface)]
        shadow-sm ring-1 ring-[color:var(--color-carely-surface-high)] transition-colors ${
        disabled
          ? 'opacity-30'
          : 'hover:bg-[color:var(--color-carely-surface-high)]'
      }`}
      aria-label={direction === 'left' ? 'Shift left' : 'Shift right'}
      title={direction === 'left' ? 'Shift left' : 'Shift right'}
    >
      {direction === 'left'
        ? <ChevronLeft className="w-5 h-5" />
        : <ChevronRight className="w-5 h-5" />
      }
    </button>
  );
}

export function StatChart({
  data,
  type,
  onNudge,
  disableNudgeRight,
}: {
  data: any[],
  type: string,
  onNudge?: (delta: number) => void,
  disableNudgeRight?: boolean,
}) {
  const canNudge = !!onNudge;

  if (!data || data.length === 0) return <div className="h-48 flex items-center justify-center text-sm font-jakarta text-[color:var(--color-carely-on-surface-variant)]">No data for this period</div>;

  const isBP = type === 'BLOOD_PRESSURE';
  
  const options: any = {
    chart: {
      type: 'line',
      toolbar: { show: false },
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      animations: { enabled: false } // disabling aniamtions during fast panning feels better
    },
    stroke: { curve: 'smooth', width: 3 },
    colors: ['#106a6a', '#fa746f'],
    markers: {
      size: 4,
      hover: { size: 6 }
    },
    xaxis: {
      type: 'datetime',
      labels: { 
        datetimeUTC: false,
        formatter: (value: string, _timestamp?: number, _opts?: any) => {
          // Apex passes a stringified timestamp for datetime axes.
          const ts = Number(value);
          if (!Number.isFinite(ts)) return String(value);
          const d = new Date(ts);
          const month = d.toLocaleDateString([], { month: 'short' });
          const day = d.getDate();
          // Two-line label: month on top, day below.
          // ApexCharts renders string[] as multi-line (tspan) labels.
          return [month, String(day)];
        },
        style: { colors: '#596061' },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false }
    },
    yaxis: {
      labels: { style: { colors: '#596061' } }
    },
    grid: { 
      borderColor: '#e3e9ea', 
      strokeDashArray: 4,
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: true } },
      column: { colors: ['var(--color-carely-surface-low)', 'transparent'], opacity: 0.4 }
    },
    dataLabels: { enabled: false },
    legend: { show: false },
    tooltip: {
      theme: 'light',
      x: { format: 'MMM dd, yyyy HH:mm' }
    }
  };

  const series = isBP ? [
    { name: 'Systolic', data: data.map(d => [d.timestamp, d.systolic]) },
    { name: 'Diastolic', data: data.map(d => [d.timestamp, d.diastolic]) }
  ] : [
    { name: 'Value', data: data.map(d => [d.timestamp, d.val]) }
  ];

  return (
    <div className="w-full mt-4 -ml-4 sm:-ml-2">
      <Chart options={options} series={series} type="line" height={250} />

      {canNudge && (
        <div className="-mt-8 flex items-center justify-between px-1 pointer-events-none">
          <NudgeButton direction="left" onClick={() => onNudge?.(1)} />
          <div className="flex-1" />
          <NudgeButton direction="right" onClick={() => onNudge?.(-1)} disabled={!!disableNudgeRight} />
        </div>
      )}
    </div>
  );
}
