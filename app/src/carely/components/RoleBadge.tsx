import React from 'react';

export function RoleBadge({ isOwner }: { isOwner: boolean }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-jakarta font-semibold tracking-wide ${
      isOwner
        ? 'bg-[color:var(--color-carely-primary)] text-white'
        : 'bg-[color:var(--color-carely-tertiary)] text-[color:var(--color-carely-primary-dim)]'
    }`}>
      {isOwner ? 'OWNER' : 'CO-MANAGER'}
    </span>
  );
}
