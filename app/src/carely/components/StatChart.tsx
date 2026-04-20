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
  variant = 'line',
  onNudge,
  disableNudgeRight,
}: {
  data: any[],
  type: string,
  // `'line'` (default): BP shows two lines (sys/dia), anything else shows a
  // single numeric line. `'count'`: used for event-kind categories and
  // renders a simple per-day bar chart whose y-axis is event count.
  variant?: 'line' | 'count',
  onNudge?: (delta: number) => void,
  disableNudgeRight?: boolean,
}) {
  const canNudge = !!onNudge;

  if (!data || data.length === 0) return <div className="h-48 flex items-center justify-center text-sm font-jakarta text-[color:var(--color-carely-on-surface-variant)]">No data for this period</div>;

  const isBP = variant === 'line' && type === 'BLOOD_PRESSURE';
  const isCount = variant === 'count';

  const options: any = {
    chart: {
      type: isCount ? 'bar' : 'line',
      toolbar: { show: false },
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      animations: { enabled: false } // disabling aniamtions during fast panning feels better
    },
    stroke: isCount ? { show: false } : { curve: 'smooth', width: 3 },
    colors: ['#106a6a', '#fa746f'],
    // plotOptions must always be defined — ApexCharts' internal bar
    // renderer unconditionally reads `config.plotOptions.bar` even when
    // the active chart type is `line`, and an undefined value here
    // throws "Cannot read properties of undefined (reading 'bar')"
    // when React re-renders the same Chart instance after the variant
    // flips.
    plotOptions: { bar: { columnWidth: '55%', borderRadius: 4 } },
    markers: isCount
      ? { size: 0 }
      : { size: 4, hover: { size: 6 } },
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
      // Event counts are always integers — skip the decimal formatter
      // ApexCharts picks by default for small ranges.
      labels: {
        style: { colors: '#596061' },
        formatter: isCount
          ? (val: number) => String(Math.round(val))
          : undefined,
      },
      ...(isCount ? { min: 0, forceNiceScale: true } : {}),
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

  const series = isBP
    ? [
        { name: 'Systolic', data: data.map(d => [d.timestamp, d.systolic]) },
        { name: 'Diastolic', data: data.map(d => [d.timestamp, d.diastolic]) },
      ]
    : isCount
      ? [{ name: 'Count', data: data.map(d => [d.timestamp, d.count]) }]
      : [{ name: 'Value', data: data.map(d => [d.timestamp, d.val]) }];

  return (
    <div className="w-full mt-4 -ml-4 sm:-ml-2">
      {/* The `key` forces ApexCharts to fully remount when the variant
          changes. Without it, switching from a line chart (numeric/BP
          category) to a bar chart (event category) leaves cached internal
          state in a bad shape and the next render throws deep inside
          Apex's bar renderer. */}
      <Chart
        key={isCount ? 'bar' : 'line'}
        options={options}
        series={series}
        type={isCount ? 'bar' : 'line'}
        height={250}
      />

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
