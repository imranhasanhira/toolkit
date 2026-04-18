import React from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';

export function CollaboratorRow({ collab, isOwner, onRemove, onUpdate }: { collab: any, isOwner: boolean, onRemove: () => void, onUpdate: (data: any) => void }) {
  const { t } = useTranslation('carely');
  const handleToggle = (key: string, value: boolean) => {
    if (!isOwner) return;
    onUpdate({ ...collab, [key]: value });
  };

  return (
    <div className="bg-[color:var(--color-carely-surface-lowest)] p-4 rounded-xl border border-[color:var(--color-carely-surface-high)] flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
         <p className="font-lexend font-semibold text-[color:var(--color-carely-on-surface)]">{collab.user.username || collab.user.email}</p>
         <p className="font-jakarta text-xs text-[color:var(--color-carely-on-surface-variant)]">{collab.user.email}</p>
      </div>
      
      <div className="flex flex-wrap items-center gap-4">
         <label className="flex items-center gap-2 text-xs font-jakarta text-[color:var(--color-carely-on-surface)]">
            <input type="checkbox" checked={collab.canViewVitals} onChange={e => handleToggle('canViewVitals', e.target.checked)} disabled={!isOwner} className="rounded text-[color:var(--color-carely-primary)] focus:ring-[color:var(--color-carely-primary)]" />
            {t('collaborator.viewVitals')}
         </label>
         <label className="flex items-center gap-2 text-xs font-jakarta text-[color:var(--color-carely-on-surface)]">
            <input type="checkbox" checked={collab.canAddVitals} onChange={e => handleToggle('canAddVitals', e.target.checked)} disabled={!isOwner} className="rounded text-[color:var(--color-carely-primary)] focus:ring-[color:var(--color-carely-primary)]" />
            {t('collaborator.addVitals')}
         </label>
         <label className="flex items-center gap-2 text-xs font-jakarta text-[color:var(--color-carely-on-surface)]">
            <input type="checkbox" checked={collab.canViewPrescription} onChange={e => handleToggle('canViewPrescription', e.target.checked)} disabled={!isOwner} className="rounded text-[color:var(--color-carely-primary)] focus:ring-[color:var(--color-carely-primary)]" />
            {t('collaborator.viewPrescription')}
         </label>
         <label className="flex items-center gap-2 text-xs font-jakarta text-[color:var(--color-carely-on-surface)]">
            <input type="checkbox" checked={collab.canEditPrescription} onChange={e => handleToggle('canEditPrescription', e.target.checked)} disabled={!isOwner} className="rounded text-[color:var(--color-carely-primary)] focus:ring-[color:var(--color-carely-primary)]" />
            {t('collaborator.editPrescription')}
         </label>
         
         {isOwner && (
           <button onClick={onRemove} className="p-2 text-[color:var(--color-carely-error)] hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors ml-auto">
             <Trash2 className="w-4 h-4" />
           </button>
         )}
      </div>
    </div>
  );
}
