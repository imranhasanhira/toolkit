import React, { useState } from 'react';
import { updateCarelyParent, deleteCarelyParent, addCarelyCollaborator, updateCarelyCollaboratorPermissions, removeCarelyCollaborator, seedCarelyMockData, clearCarelyMockData } from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import { Shield, Plus, Trash2 } from 'lucide-react';
import { CollaboratorRow } from '../components/CollaboratorRow';
import { ConfirmDialog } from '../components/ConfirmDialog';
import toast from 'react-hot-toast';

export function SettingsTab({ parent }: { parent: any }) {
  const { data: user } = useAuth();
  const isOwner = user?.id === parent.createdByUserId;
  const [email, setEmail] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<'seed' | 'clear' | 'delete' | null>(null);
  
  const [name, setName] = useState(parent.name || '');
  const [dob, setDob] = useState(parent.dateOfBirth ? new Date(parent.dateOfBirth).toISOString().split('T')[0] : '');
  const [temperatureUnit, setTemperatureUnit] = useState<'C' | 'F'>((parent.temperatureUnit === 'C' ? 'C' : 'F'));

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setIsUpdatingProfile(true);
    try {
      await updateCarelyParent({
        id: parent.id,
        name,
        dateOfBirth: dob ? new Date(dob) : undefined,
        temperatureUnit,
      });
      toast.success('Profile updated');
    } catch(err: any) {
      toast.error('Update failed: ' + err.message);
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
      toast.success('Co-manager added');
    } catch(err: any) {
      toast.error(err.message);
    }
  };

  const handleRemoveCollab = async (id: string) => {
    try {
      await removeCarelyCollaborator({ id });
      toast.success('Co-manager removed');
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
      toast.success('Permissions updated');
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
      toast.success('Mock data injected successfully');
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
      toast.success('Mock data cleared');
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
      toast.error('Failed to delete: ' + e.message);
      setIsDeleting(false);
    }
  };

  const confirmConfig = (() => {
    if (confirmKind === 'seed') {
      return {
        title: 'Seed mock data?',
        description: 'This will inject 60 days of mock vitals and a mock prescription. You can clear mock data later.',
        confirmText: 'Seed mock data',
        confirmTone: 'primary' as const,
        onConfirm: confirmSeedMockData,
        isConfirming: isSeeding,
      };
    }
    if (confirmKind === 'clear') {
      return {
        title: 'Clear mock data?',
        description: 'This will delete all mock records marked MOCK_DATA for this patient.',
        confirmText: 'Clear mock data',
        confirmTone: 'danger' as const,
        onConfirm: confirmClearMockData,
        isConfirming: isSeeding,
      };
    }
    if (confirmKind === 'delete') {
      return {
        title: 'Delete patient record?',
        description: 'This will permanently remove all associated vitals, prescriptions, and intake logs. This cannot be undone.',
        confirmText: 'Delete',
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
            Patient Profile
          </h2>
          <form onSubmit={handleUpdateProfile} className="bg-[color:var(--color-carely-surface-lowest)] p-5 rounded-2xl border border-[color:var(--color-carely-surface-high)] shadow-xs space-y-4">
            <div>
              <label className="text-xs font-jakarta font-semibold text-[color:var(--color-carely-on-surface-variant)] uppercase block mb-1.5 ml-1">Full Name</label>
              <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-[color:var(--color-carely-surface-low)] border-none rounded-xl p-3 font-jakarta text-[color:var(--color-carely-on-surface)]" />
            </div>
            <div>
              <label className="text-xs font-jakarta font-semibold text-[color:var(--color-carely-on-surface-variant)] uppercase block mb-1.5 ml-1">Date of Birth</label>
              <input type="date" value={dob} onChange={e => setDob(e.target.value)} className="w-full bg-[color:var(--color-carely-surface-low)] border-none rounded-xl p-3 font-jakarta text-[color:var(--color-carely-on-surface)]" />
            </div>
            <div>
              <label className="text-xs font-jakarta font-semibold text-[color:var(--color-carely-on-surface-variant)] uppercase block mb-1.5 ml-1">Temperature Unit</label>
              <select
                value={temperatureUnit}
                onChange={(e) => setTemperatureUnit(e.target.value === 'C' ? 'C' : 'F')}
                className="w-full bg-[color:var(--color-carely-surface-low)] border-none rounded-xl p-3 font-jakarta text-[color:var(--color-carely-on-surface)]"
              >
                <option value="F">Fahrenheit (°F)</option>
                <option value="C">Celsius (°C)</option>
              </select>
            </div>
            <button disabled={isUpdatingProfile} type="submit" className="w-full bg-[color:var(--color-carely-primary)] text-white font-jakarta font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity mt-2 disabled:opacity-50">
              {isUpdatingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </div>
      )}

      <div>
        <h2 className="font-lexend font-bold text-[color:var(--color-carely-on-surface)] text-xl flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-[color:var(--color-carely-primary)]" />
          Co-Management
        </h2>
        <p className="font-jakarta text-sm text-[color:var(--color-carely-on-surface-variant)] mb-6">Manage who has access to view and edit this patient's records.</p>
        
        {isOwner && (
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3 mb-6 bg-[color:var(--color-carely-surface-lowest)] p-4 rounded-2xl border border-[color:var(--color-carely-surface-high)] shadow-xs">
            <input 
              type="email" 
              placeholder="Enter user's email address" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="flex-1 bg-[color:var(--color-carely-surface-low)] border-none rounded-xl p-3 font-jakarta text-[color:var(--color-carely-on-surface)] text-sm focus:ring-2 focus:ring-[color:var(--color-carely-primary)]"
              required 
            />
            <button type="submit" className="bg-[color:var(--color-carely-primary)] text-[color:var(--color-carely-on-primary)] px-6 py-3 rounded-xl font-jakarta font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity whitespace-nowrap">
              <Plus className="w-4 h-4" /> Invite
            </button>
          </form>
        )}

        <div className="space-y-3">
          {parent.collaborators?.length > 0 ? (
            parent.collaborators.map((c: any) => (
              <CollaboratorRow key={c.id} collab={c} isOwner={isOwner} onRemove={() => handleRemoveCollab(c.id)} onUpdate={handleUpdateCollab} />
            ))
          ) : (
            <div className="text-center py-8 font-jakarta text-sm text-[color:var(--color-carely-on-surface-variant)] italic bg-[color:var(--color-carely-surface-lowest)] rounded-2xl border border-dashed border-[color:var(--color-carely-surface-high)]">No co-managers added yet.</div>
          )}
        </div>
      </div>

      {isOwner && (
        <div className="pt-8 border-t border-[color:var(--color-carely-surface-high)]">
          <h2 className="font-lexend font-bold text-[color:var(--color-carely-on-surface)] text-xl mb-2">Developer Tools</h2>
          <p className="font-jakarta text-sm text-[color:var(--color-carely-on-surface-variant)] mb-4">Inject safe mock data to test charts and logs. All mock entries are specially marked and can be instantly cleared.</p>
          <div className="flex gap-3">
             <button onClick={handleSeedMockData} disabled={isSeeding} className="bg-[color:var(--color-carely-surface-low)] border border-[color:var(--color-carely-primary)]/30 text-[color:var(--color-carely-primary)] px-4 py-2 rounded-xl font-jakarta font-medium text-sm hover:bg-[color:var(--color-carely-primary)]/10 transition-colors disabled:opacity-50">
               {isSeeding ? 'Processing...' : 'Seed Mock Data (60 Days)'}
             </button>
             <button onClick={handleClearMockData} disabled={isSeeding} className="bg-[color:var(--color-carely-surface-low)] border border-[color:var(--color-carely-surface-high)] text-[color:var(--color-carely-on-surface-variant)] px-4 py-2 rounded-xl font-jakarta font-medium text-sm hover:bg-[color:var(--color-carely-surface-high)] transition-colors disabled:opacity-50">
               Clear Mock Data
             </button>
          </div>
        </div>
      )}

      {isOwner && (
        <div className="pt-8 border-t border-[color:var(--color-carely-surface-high)]">
          <h2 className="font-lexend font-bold text-[color:var(--color-carely-error)] text-xl mb-2">Danger Zone</h2>
          <p className="font-jakarta text-sm text-[color:var(--color-carely-on-surface-variant)] mb-4">Deleting this patient will permanently remove all associated vitals, prescriptions, and intake logs.</p>
          <button onClick={handleDelete} disabled={isDeleting} className="bg-[color:var(--color-carely-error)] text-white px-6 py-2 rounded-xl font-jakarta font-medium text-sm flex items-center gap-2 hover:opacity-90 transition-opacity">
            <Trash2 className="w-4 h-4" /> {isDeleting ? 'Deleting...' : 'Delete Patient Record'}
          </button>
        </div>
      )}
    </div>
  );
}
