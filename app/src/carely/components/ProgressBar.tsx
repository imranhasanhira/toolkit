import React from 'react';

export function ProgressBar({ progress, max = 100, colorClass = "bg-[color:var(--color-carely-primary)]" }: { progress: number, max?: number, colorClass?: string }) {
  const pct = Math.min(100, Math.max(0, (progress / max) * 100));
  return (
    <div className="w-full h-2 bg-[color:var(--color-carely-surface-low)] rounded-full overflow-hidden">
      <div 
        className={`h-full rounded-full transition-all duration-500 ease-out ${colorClass}`} 
        style={{ width: `${pct}%` }} 
      />
    </div>
  );
}
