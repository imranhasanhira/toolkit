import React from 'react';
import { Home, LineChart, Pill, Settings, Activity } from 'lucide-react';
import { Link, useLocation } from 'react-router';

export function BottomTabBar({ parentId }: { parentId: string }) {
  const location = useLocation();
  
  const tabs = [
    { id: 'measurements', icon: Activity, label: 'Log', path: `/carely/parent/${parentId}` },
    { id: 'medicine', icon: Pill, label: 'Meds', path: `/carely/parent/${parentId}?tab=medicine` },
    { id: 'stats', icon: LineChart, label: 'Stats', path: `/carely/parent/${parentId}?tab=stats` },
    { id: 'settings', icon: Settings, label: 'Settings', path: `/carely/parent/${parentId}?tab=settings` },
  ];

  const query = new URLSearchParams(location.search);
  const currentTab = query.get('tab') || 'measurements';

  return (
    <div id="carely-bottom-tab-bar" className="fixed bottom-0 left-0 right-0 bg-[color:var(--color-carely-surface-lowest)] border-t border-[color:var(--color-carely-surface-high)] px-4 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.03)] z-50 lg:hidden">
      <div className="flex justify-between items-center max-w-md mx-auto">
        {tabs.map((tab) => {
          const active = currentTab === tab.id;
          const Icon = tab.icon;
          return (
            <Link key={tab.id} to={tab.path} className="flex flex-col items-center p-2 flex-1 relative">
              <Icon className={`w-6 h-6 mb-1 transition-colors ${active ? 'text-[color:var(--color-carely-primary)]' : 'text-[color:var(--color-carely-on-surface-variant)]'}`} />
              <span className={`text-[10px] font-jakarta font-medium transition-colors ${active ? 'text-[color:var(--color-carely-primary)]' : 'text-[color:var(--color-carely-on-surface-variant)]'}`}>
                {tab.label}
              </span>
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[color:var(--color-carely-primary)] rounded-b-full shadow-[0_2px_8px_var(--color-carely-primary)]" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
