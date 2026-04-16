import React from 'react';

export function MetricChip({ label, selected, onClick }: { label: string, selected: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-jakarta font-medium transition-all flex-[0_0_auto] text-center ${
        selected 
          ? 'bg-[color:var(--color-carely-primary)] text-white shadow-xs' 
          : 'bg-[color:var(--color-carely-surface-lowest)] border border-[color:var(--color-carely-surface-high)] text-[color:var(--color-carely-on-surface-variant)] hover:bg-[color:var(--color-carely-surface-low)]'
      }`}
    >
      {label}
    </button>
  );
}
