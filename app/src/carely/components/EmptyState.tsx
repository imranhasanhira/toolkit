import React from 'react';
import { LucideIcon } from 'lucide-react';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
};

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-[color:var(--color-carely-surface-lowest)] shadow-xs rounded-2xl border border-[color:var(--color-carely-surface-high)]">
       <div className="w-16 h-16 bg-[color:var(--color-carely-surface-low)] rounded-full flex items-center justify-center mb-4 text-[color:var(--color-carely-primary)]">
         <Icon className="w-8 h-8 opacity-80" />
       </div>
       <h3 className="font-lexend font-bold text-[color:var(--color-carely-on-surface)] text-lg mb-2">{title}</h3>
       <p className="font-jakarta text-[color:var(--color-carely-on-surface-variant)] mb-6 text-sm max-w-sm">{description}</p>
       {action && <div>{action}</div>}
    </div>
  );
}
