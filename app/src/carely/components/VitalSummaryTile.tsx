import React from 'react';
import { Activity } from 'lucide-react';

export function VitalSummaryTile({ label, value, date, trend }: { label: string, value: string, date: string, trend?: 'up' | 'down' | 'stable' }) {
  return (
    <div className="bg-[color:var(--color-carely-surface-lowest)] p-3 rounded-xl border border-[color:var(--color-carely-surface-high)] flex flex-col gap-1">
      <div className="flex justify-between items-center text-[color:var(--color-carely-on-surface-variant)] text-xs font-jakarta">
        <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {label}</span>
        <span>{date}</span>
      </div>
      <div className="font-lexend font-bold text-[color:var(--color-carely-on-surface)] text-lg">
        {value}
      </div>
    </div>
  );
}
