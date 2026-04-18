import React, { useState } from 'react';
import { updateCarelyParent, deleteCarelyParent, addCarelyCollaborator, updateCarelyCollaboratorPermissions, removeCarelyCollaborator, seedCarelyMockData, clearCarelyMockData } from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import { Shield, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CollaboratorRow } from '../components/CollaboratorRow';
import { ConfirmDialog } from '../components/ConfirmDialog';
import toast from 'react-hot-toast';

export function SettingsTab({ parent }: { parent: any }) {
  const { data: user } = useAuth();
  const { t } = useTranslation('carely');
  const isOwner = user?.id === parent.createdByUserId;
  const [email, setEmail] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<'seed' | 'clear' | 'delete' | null>(null);
  
  const [name, setName] = useState(parent.name || '');
  const [dob, setDob] = useState(parent.dateOfBirth ? new Date(parent.dateOfBirth).toISOString().split('T')[0] : '');

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setIsUpdatingProfile(true);
    try {
      await updateCarelyParent({
        id: parent.id,
        name,
        dateOfBirth: dob ? new Date(dob) : undefined,
      });
      toast.success(t('settings.toasts.profileUpdated'));
    } catch(err: any) {
      toast.error(t('settings.toasts.updateFailed', { reason: err.message }));
    } finally {
      setIsUpdatingProfile(false);
    }
  };
  
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    try {
      await addCarelyCollaborator({ parentId: parent.id, email });
      setEmail('');
      toast.success(t('settings.toasts.coManagerAdded'));
    } catch(err: any) {
      toast.error(err.message);
    }
  };

  const handleRemoveCollab = async (id: string) => {
    try {
      await removeCarelyCollaborator({ id });
      toast.success(t('settings.toasts.coManagerRemoved'));
    } catch(e: any) { toast.error(e.message); }
  };

  const handleUpdateCollab = async (collab: any) => {
    try {
      await updateCarelyCollaboratorPermissions({ 
        id: collab.id, 
        canViewVitals: collab.canViewVitals,
        canAddVitals: collab.canAddVitals,
        canViewPrescription: collab.canViewPrescription,
        canEditPrescription: collab.canEditPrescription
      });
      toast.success(t('settings.toasts.permissionsUpdated'));
    } catch(e: any) { toast.error(e.message); }
  };

  const handleSeedMockData = async () => {
    setConfirmKind('seed');
    setConfirmOpen(true);
  };

  const confirmSeedMockData = async () => {
    setIsSeeding(true);
    try {
      await seedCarelyMockData({ parentId: parent.id });
      toast.success(t('settings.toasts.mockSeeded'));
    } catch(e: any) { toast.error(e.message); }
    finally { setIsSeeding(false); }
  };

  const handleClearMockData = async () => {
    setConfirmKind('clear');
    setConfirmOpen(true);
  };

  const confirmClearMockData = async () => {
    setIsSeeding(true);
    try {
      await clearCarelyMockData({ parentId: parent.id });
      toast.success(t('settings.toasts.mockCleared'));
    } catch(e: any) { toast.error(e.message); }
    finally { setIsSeeding(false); }
  };

  const handleDelete = async () => {
    setConfirmKind('delete');
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteCarelyParent({ id: parent.id });
      window.location.href = '/carely';
    } catch(e: any) {
      toast.error(t('settings.toasts.deleteFailed', { reason: e.message }));
      setIsDeleting(false);
    }
  };

  const confirmConfig = (() => {
    if (confirmKind === 'seed') {
      return {
        title: t('settings.confirm.seed.title'),
        description: t('settings.confirm.seed.description'),
        confirmText: t('settings.confirm.seed.confirm'),
        confirmTone: 'primary' as const,
        onConfirm: confirmSeedMockData,
        isConfirming: isSeeding,
      };
    }
    if (confirmKind === 'clear') {
      return {
        title: t('settings.confirm.clear.title'),
        description: t('settings.confirm.clear.description'),
        confirmText: t('settings.confirm.clear.confirm'),
        confirmTone: 'danger' as const,
        onConfirm: confirmClearMockData,
        isConfirming: isSeeding,
      };
    }
    if (confirmKind === 'delete') {
      return {
        title: t('settings.confirm.delete.title'),
        description: t('settings.confirm.delete.description'),
        confirmText: t('settings.confirm.delete.confirm'),
        confirmTone: 'danger' as const,
        onConfirm: confirmDelete,
        isConfirming: isDeleting,
      };
    }
    return null;
  })();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 lg:pb-0">
      {confirmConfig && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={(o) => {
            setConfirmOpen(o);
            if (!o) setConfirmKind(null);
          }}
          title={confirmConfig.title}
          description={confirmConfig.description}
          confirmText={confirmConfig.confirmText}
          confirmTone={confirmConfig.confirmTone}
          isConfirming={confirmConfig.isConfirming}
          onConfirm={async () => {
            await confirmConfig.onConfirm();
            setConfirmOpen(false);
            setConfirmKind(null);
          }}
        />
      )}
      
      {isOwner && (
        <div>
          <h2 className="font-lexend font-bold text-[color:var(--color-carely-on-surface)] text-xl mb-4 text-left">
            {t('settings.profile.title')}
          </h2>
          <form onSubmit={handleUpdateProfile} className="bg-[color:var(--color-carely-surface-lowest)] p-5 rounded-2xl border border-[color:var(--color-carely-surface-high)] shadow-xs space-y-4">
            <div>
              <label className="text-xs font-jakarta font-semibold text-[color:var(--color-carely-on-surface-variant)] uppercase block mb-1.5 ml-1">{t('settings.profile.fullName')}</label>
              <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-[color:var(--color-carely-surface-low)] border-none rounded-xl p-3 font-jakarta text-[color:var(--color-carely-on-surface)]" />
            </div>
            <div>
              <label className="text-xs font-jakarta font-semibold text-[color:var(--color-carely-on-surface-variant)] uppercase block mb-1.5 ml-1">{t('settings.profile.dob')}</label>
              <input type="date" value={dob} onChange={e => setDob(e.target.value)} className="w-full bg-[color:var(--color-carely-surface-low)] border-none rounded-xl p-3 font-jakarta text-[color:var(--color-carely-on-surface)]" />
            </div>
            <div>
              <p className="font-jakarta text-sm text-[color:var(--color-carely-on-surface-variant)]">
                {t('settings.profile.tempNotice')}
              </p>
            </div>
            <button disabled={isUpdatingProfile} type="submit" className="w-full bg-[color:var(--color-carely-primary)] text-white font-jakarta font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity mt-2 disabled:opacity-50">
              {isUpdatingProfile ? t('settings.profile.saving') : t('settings.profile.save')}
            </button>
          </form>
        </div>
      )}

      <div>
        <h2 className="font-lexend font-bold text-[color:var(--color-carely-on-surface)] text-xl flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-[color:var(--color-carely-primary)]" />
          {t('settings.coManagement.title')}
        </h2>
        <p className="font-jakarta text-sm text-[color:var(--color-carely-on-surface-variant)] mb-6">{t('settings.coManagement.description')}</p>
        
        {isOwner && (
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3 mb-6 bg-[color:var(--color-carely-surface-lowest)] p-4 rounded-2xl border border-[color:var(--color-carely-surface-high)] shadow-xs">
            <input 
              type="email" 
              placeholder={t('settings.coManagement.emailPlaceholder')} 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="flex-1 bg-[color:var(--color-carely-surface-low)] border-none rounded-xl p-3 font-jakarta text-[color:var(--color-carely-on-surface)] text-sm focus:ring-2 focus:ring-[color:var(--color-carely-primary)]"
              required 
            />
            <button type="submit" className="bg-[color:var(--color-carely-primary)] text-[color:var(--color-carely-on-primary)] px-6 py-3 rounded-xl font-jakarta font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity whitespace-nowrap">
              <Plus className="w-4 h-4" /> {t('settings.coManagement.invite')}
            </button>
          </form>
        )}

        <div className="space-y-3">
          {parent.collaborators?.length > 0 ? (
            parent.collaborators.map((c: any) => (
              <CollaboratorRow key={c.id} collab={c} isOwner={isOwner} onRemove={() => handleRemoveCollab(c.id)} onUpdate={handleUpdateCollab} />
            ))
          ) : (
            <div className="text-center py-8 font-jakarta text-sm text-[color:var(--color-carely-on-surface-variant)] italic bg-[color:var(--color-carely-surface-lowest)] rounded-2xl border border-dashed border-[color:var(--color-carely-surface-high)]">{t('settings.coManagement.empty')}</div>
          )}
        </div>
      </div>

      {isOwner && (
        <div className="pt-8 border-t border-[color:var(--color-carely-surface-high)]">
          <h2 className="font-lexend font-bold text-[color:var(--color-carely-on-surface)] text-xl mb-2">{t('settings.developer.title')}</h2>
          <p className="font-jakarta text-sm text-[color:var(--color-carely-on-surface-variant)] mb-4">{t('settings.developer.description')}</p>
          <div className="flex gap-3">
             <button onClick={handleSeedMockData} disabled={isSeeding} className="bg-[color:var(--color-carely-surface-low)] border border-[color:var(--color-carely-primary)]/30 text-[color:var(--color-carely-primary)] px-4 py-2 rounded-xl font-jakarta font-medium text-sm hover:bg-[color:var(--color-carely-primary)]/10 transition-colors disabled:opacity-50">
               {isSeeding ? t('settings.developer.processing') : t('settings.developer.seedMock')}
             </button>
             <button onClick={handleClearMockData} disabled={isSeeding} className="bg-[color:var(--color-carely-surface-low)] border border-[color:var(--color-carely-surface-high)] text-[color:var(--color-carely-on-surface-variant)] px-4 py-2 rounded-xl font-jakarta font-medium text-sm hover:bg-[color:var(--color-carely-surface-high)] transition-colors disabled:opacity-50">
               {t('settings.developer.clearMock')}
             </button>
          </div>
        </div>
      )}

      {isOwner && (
        <div className="pt-8 border-t border-[color:var(--color-carely-surface-high)]">
          <h2 className="font-lexend font-bold text-[color:var(--color-carely-error)] text-xl mb-2">{t('settings.danger.title')}</h2>
          <p className="font-jakarta text-sm text-[color:var(--color-carely-on-surface-variant)] mb-4">{t('settings.danger.description')}</p>
          <button onClick={handleDelete} disabled={isDeleting} className="bg-[color:var(--color-carely-error)] text-white px-6 py-2 rounded-xl font-jakarta font-medium text-sm flex items-center gap-2 hover:opacity-90 transition-opacity">
            <Trash2 className="w-4 h-4" /> {isDeleting ? t('settings.danger.deleting') : t('settings.danger.deleteButton')}
          </button>
        </div>
      )}
    </div>
  );
}
