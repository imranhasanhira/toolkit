import React from 'react';

type Tab = { id: string; label: string; icon?: React.ReactNode };

export function TabSwitcher({ tabs, activeId, onChange }: { tabs: Tab[], activeId: string, onChange: (id: string) => void }) {
  return (
    <div className="flex space-x-1 bg-[color:var(--color-carely-surface-high)] p-1 rounded-xl">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-jakarta font-medium transition-all ${
              active 
                ? 'bg-[color:var(--color-carely-surface-lowest)] text-[color:var(--color-carely-primary)] shadow-[0_1px_3px_rgba(0,0,0,0.1)]' 
                : 'text-[color:var(--color-carely-on-surface-variant)] hover:text-[color:var(--color-carely-on-surface)]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
