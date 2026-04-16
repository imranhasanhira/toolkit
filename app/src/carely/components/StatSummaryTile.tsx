import React from 'react';

export function StatSummaryTile({ title, value, unit }: { title: string, value: string, unit: string }) {
  return (
    <div className="bg-[color:var(--color-carely-surface-low)] p-4 rounded-2xl flex-[1_1_0%] flex flex-col justify-center min-w-0">
      <span className="text-[10px] font-jakarta font-semibold uppercase tracking-wider text-[color:var(--color-carely-on-surface-variant)] mb-1 truncate">{title}</span>
      <div className="font-lexend font-bold text-[color:var(--color-carely-on-surface)] text-lg md:text-xl truncate">
        {value} <span className="text-xs md:text-sm font-jakarta text-[color:var(--color-carely-on-surface-variant)] font-normal ml-1">{unit}</span>
      </div>
    </div>
  );
}
