import React from 'react';

export function StatusBadge({ active, className = '' }: { active: boolean, className?: string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-jakarta font-medium border ${
      active 
        ? 'bg-[color:var(--color-carely-success)] text-[#0f5132] border-[#badbcc]'
        : 'bg-[color:var(--color-carely-surface-low)] text-[color:var(--color-carely-on-surface-variant)] border-[color:var(--color-carely-surface-high)]'
    } ${className}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-[#0f5132]' : 'bg-[color:var(--color-carely-on-surface-variant)]'}`} />
      {active ? 'Active' : 'Inactive'}
    </div>
  );
}
