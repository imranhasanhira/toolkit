import React from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ParentAvatar } from './ParentAvatar';
import { RoleBadge } from './RoleBadge';

export function ParentCard({ parent, isOwner }: { parent: any, isOwner: boolean }) {
  const navigate = useNavigate();
  const { t } = useTranslation('carely');
  const age = parent.dateOfBirth
    ? new Date().getFullYear() - new Date(parent.dateOfBirth).getFullYear()
    : null;
  return (
    <div onClick={() => navigate(`/carely/parent/${parent.id}`)} className="cursor-pointer block bg-[color:var(--color-carely-surface-lowest)] p-5 rounded-2xl border border-[color:var(--color-carely-surface-high)] shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[color:var(--color-carely-tertiary)] opacity-30 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
      <div className="flex items-start justify-between relative z-10">
        <div className="flex gap-4 items-center">
          <ParentAvatar name={parent.name} url={parent.avatarUrl} size="lg" />
          <div>
            <h3 className="font-lexend font-bold text-xl text-[color:var(--color-carely-on-surface)] group-hover:text-[color:var(--color-carely-primary)] transition-colors">{parent.name}</h3>
            {age !== null && (
              <p className="font-jakarta text-sm text-[color:var(--color-carely-on-surface-variant)] mt-0.5">
                {t('patient.yearsOld', { count: age })}
              </p>
            )}
          </div>
        </div>
        <RoleBadge isOwner={isOwner} />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 relative z-10">
        <div onClick={(e) => { e.stopPropagation(); navigate(`/carely/parent/${parent.id}?tab=measurements`); }} className="bg-[color:var(--color-carely-surface-low)] px-3 py-2 rounded-lg hover:bg-[color:var(--color-carely-surface-high)] transition-colors">
           <span className="block text-[10px] text-[color:var(--color-carely-on-surface-variant)] uppercase tracking-wider font-semibold">{t('parentCard.latestVitals')}</span>
           <span className="font-lexend font-medium text-[color:var(--color-carely-on-surface)]">{t('parentCard.viewActivity')}</span>
        </div>
        <div onClick={(e) => { e.stopPropagation(); navigate(`/carely/parent/${parent.id}?tab=medicine`); }} className="bg-[color:var(--color-carely-surface-low)] px-3 py-2 rounded-lg hover:bg-[color:var(--color-carely-surface-high)] transition-colors">
           <span className="block text-[10px] text-[color:var(--color-carely-on-surface-variant)] uppercase tracking-wider font-semibold">{t('parentCard.meds')}</span>
           <span className="font-lexend font-medium text-[color:var(--color-carely-on-surface)]">{t('parentCard.openSchedule')}</span>
        </div>
      </div>
    </div>
  );
}
