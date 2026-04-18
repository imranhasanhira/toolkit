import React from 'react';
import { useTranslation } from 'react-i18next';

export function RoleBadge({ isOwner }: { isOwner: boolean }) {
  const { t } = useTranslation('carely');
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-jakarta font-semibold tracking-wide ${
      isOwner
        ? 'bg-[color:var(--color-carely-primary)] text-white'
        : 'bg-[color:var(--color-carely-tertiary)] text-[color:var(--color-carely-primary-dim)]'
    }`}>
      {isOwner ? t('roles.owner') : t('roles.coManager')}
    </span>
  );
}
