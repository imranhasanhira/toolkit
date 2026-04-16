import React from 'react';

export function VitalTypeChip({ label, selected, onClick }: { label: string, selected: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-2 shrink-0 rounded-full text-xs font-jakarta font-semibold transition-all ${
        selected 
          ? 'bg-[color:var(--color-carely-primary)] text-white shadow-xs' 
          : 'bg-[color:var(--color-carely-surface-lowest)] border border-[color:var(--color-carely-surface-high)] text-[color:var(--color-carely-on-surface-variant)] hover:bg-[color:var(--color-carely-surface-low)]'
      }`}
    >
      {label}
    </button>
  );
}
