import React, { useMemo, useState } from 'react';
import { useAction, useQuery, getCarelyParents, getCarelyVitalCategories, getCarelyAppSettings, updateCarelyAppSettings, upsertCarelyVitalCategory, deleteCarelyVitalCategory, reorderCarelyVitalCategories } from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import { ArrowDown, ArrowUp, Heart, Pencil, Settings, Trash2, X } from 'lucide-react';
import { ParentCard } from './components/ParentCard';
import { AddParentModal } from './components/AddParentModal';
import { EmptyState } from './components/EmptyState';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../client/components/ui/dialog';
import { Input } from '../client/components/ui/input';
import { Label } from '../client/components/ui/label';
import { Checkbox } from '../client/components/ui/checkbox';
import toast from 'react-hot-toast';

export default function CarelyHomePage() {
  const { data: user } = useAuth();
  const { data: parents, isLoading, refetch } = useQuery(getCarelyParents);
  const { data: categories = [], refetch: refetchCategories } = useQuery(getCarelyVitalCategories);
  const { data: appSettings, refetch: refetchAppSettings } = useQuery(getCarelyAppSettings);
  const updateAppSettings = useAction(updateCarelyAppSettings);
  const upsertCategory = useAction(upsertCarelyVitalCategory);
  const deleteCategory = useAction(deleteCarelyVitalCategory);
  const reorderCategories = useAction(reorderCarelyVitalCategories);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const orderedCategories = useMemo(() => {
    return [...categories].sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [categories]);

  const [draft, setDraft] = useState<{ key: string; displayName: string; kind: 'numeric' | 'blood_pressure'; unit: string; isActive: boolean }>({
    key: '',
    displayName: '',
    kind: 'numeric',
    unit: '',
    isActive: true,
  });

  const isPersisted =
    orderedCategories.every((c: any) => !String(c.id).startsWith('__default__')) &&
    !String((appSettings as any)?.id ?? '').startsWith('__default__');

  if (isLoading) return <div className="flex h-[50vh] items-center justify-center font-jakarta text-[color:var(--color-carely-on-surface-variant)]">Loading overview...</div>;

  return (
    <div className="min-h-screen bg-[color:var(--color-carely-surface)] px-4 py-8 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="font-lexend text-3xl font-bold text-[color:var(--color-carely-on-surface)]">Carely</h1>
            <p className="font-jakarta text-[color:var(--color-carely-on-surface-variant)] mt-1">Hello, {user?.username || 'Caregiver'}. Here's the health overview.</p>
          </div>
          <div className="flex items-center gap-2">
            {user?.isAdmin && (
              <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogTrigger asChild>
                  <button
                    className="h-10 w-10 inline-flex items-center justify-center rounded-xl bg-[color:var(--color-carely-surface-lowest)] border border-[color:var(--color-carely-surface-high)] text-[color:var(--color-carely-on-surface-variant)] hover:bg-[color:var(--color-carely-surface-low)] transition-colors shadow-xs"
                    title="Carely settings"
                    type="button"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg bg-[color:var(--color-carely-surface-lowest)] border-[color:var(--color-carely-surface-high)] rounded-2xl">
                  <DialogHeader>
                    <DialogTitle className="font-lexend text-[color:var(--color-carely-on-surface)] text-lg">
                      Carely settings
                    </DialogTitle>
                  </DialogHeader>

                  <div className="mt-3 space-y-3">
                    <div className="rounded-xl border border-[color:var(--color-carely-surface-high)] bg-[color:var(--color-carely-surface-low)] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-jakarta font-semibold text-sm text-[color:var(--color-carely-on-surface)]">
                            Temperature unit
                          </div>
                          <div className="text-xs font-jakarta text-[color:var(--color-carely-on-surface-variant)]">
                            Used for all temperature entries in Carely
                          </div>
                        </div>
                        <select
                          value={(appSettings as any)?.temperatureUnit === 'C' ? 'C' : 'F'}
                          onChange={async (e) => {
                            await updateAppSettings({ temperatureUnit: (e.target.value === 'C' ? 'C' : 'F') } as any);
                            refetchAppSettings();
                          }}
                          className="bg-[color:var(--color-carely-surface-lowest)] border border-[color:var(--color-carely-surface-high)] rounded-xl px-3 py-2.5 font-jakarta text-[color:var(--color-carely-on-surface)]"
                          disabled={!isPersisted}
                        >
                          <option value="F">Fahrenheit (°F)</option>
                          <option value="C">Celsius (°C)</option>
                        </select>
                      </div>
                      {!isPersisted && (
                        <p className="mt-2 text-xs font-jakarta text-[color:var(--color-carely-on-surface-variant)]">
                          Run the DB migrations to make settings editable.
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl border border-[color:var(--color-carely-surface-high)] bg-[color:var(--color-carely-surface-low)] p-3">
                      <div className="font-lexend font-semibold text-[color:var(--color-carely-on-surface)] mb-2">
                        Vital categories
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Key</Label>
                          <Input value={draft.key} onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))} placeholder="e.g. HEAD_CIRCUMFERENCE" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Name</Label>
                          <Input value={draft.displayName} onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))} placeholder="e.g. Head circumference" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Kind</Label>
                          <select
                            value={draft.kind}
                            onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as any }))}
                            className="w-full bg-[color:var(--color-carely-surface-lowest)] border border-[color:var(--color-carely-surface-high)] rounded-xl px-3 py-2.5 font-jakarta text-[color:var(--color-carely-on-surface)]"
                          >
                            <option value="numeric">Numeric</option>
                            <option value="blood_pressure">Blood pressure</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Unit</Label>
                          <Input value={draft.unit} onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))} placeholder="e.g. cm, kg, bpm" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={draft.isActive}
                            onCheckedChange={(v) => setDraft((d) => ({ ...d, isActive: !!v }))}
                            id="carely-cat-active"
                          />
                          <Label htmlFor="carely-cat-active">Active</Label>
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          className="h-10 inline-flex items-center justify-center rounded-xl bg-[color:var(--color-carely-primary)] text-white px-4 font-jakarta font-semibold shadow-xs hover:opacity-90"
                          onClick={async () => {
                            await upsertCategory({
                              ...(editingId ? { id: editingId } : {}),
                              key: draft.key,
                              displayName: draft.displayName,
                              kind: draft.kind,
                              unit: draft.unit || null,
                              isActive: draft.isActive,
                            } as any);
                            setDraft({ key: '', displayName: '', kind: 'numeric', unit: '', isActive: true });
                            setEditingId(null);
                            refetchCategories();
                          }}
                          disabled={!isPersisted}
                        >
                          {editingId ? 'Save changes' : 'Add category'}
                        </button>
                        {editingId && (
                          <button
                            type="button"
                            className="ml-2 h-10 w-10 inline-flex items-center justify-center rounded-xl bg-[color:var(--color-carely-surface-lowest)] border border-[color:var(--color-carely-surface-high)] text-[color:var(--color-carely-on-surface-variant)] hover:bg-[color:var(--color-carely-surface-low)] transition-colors"
                            title="Cancel edit"
                            onClick={() => {
                              setEditingId(null);
                              setDraft({ key: '', displayName: '', kind: 'numeric', unit: '', isActive: true });
                            }}
                            disabled={!isPersisted}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {orderedCategories.map((c: any, idx: number) => (
                        <div
                          key={c.id}
                          className="flex items-center gap-2 rounded-xl border border-[color:var(--color-carely-surface-high)] bg-[color:var(--color-carely-surface-lowest)] px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-jakarta font-semibold text-sm text-[color:var(--color-carely-on-surface)] truncate">
                              {c.displayName}
                            </div>
                            <div className="text-xs font-jakarta text-[color:var(--color-carely-on-surface-variant)] truncate">
                              {c.key} · {c.kind}{c.unit ? ` · ${c.unit}` : ''}
                            </div>
                          </div>

                          <button
                            type="button"
                            className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-[color:var(--color-carely-surface-high)] hover:bg-[color:var(--color-carely-surface-low)] disabled:opacity-30"
                            disabled={!isPersisted}
                            title="Edit category"
                            onClick={() => {
                              setEditingId(c.id);
                              setDraft({
                                key: c.key ?? '',
                                displayName: c.displayName ?? '',
                                kind: (c.kind as any) ?? 'numeric',
                                unit: c.unit ?? '',
                                isActive: c.isActive !== false,
                              });
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-[color:var(--color-carely-surface-high)] hover:bg-[color:var(--color-carely-surface-low)] disabled:opacity-30"
                            disabled={!isPersisted || idx === 0}
                            title="Move up"
                            onClick={async () => {
                              try {
                                const next = [...orderedCategories];
                                [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                await reorderCategories({ orderedIds: next.map((x: any) => x.id) } as any);
                                toast.success('Order updated');
                                refetchCategories();
                              } catch (e: any) {
                                toast.error('Reorder failed: ' + (e?.message || 'Unknown error'));
                              }
                            }}
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-[color:var(--color-carely-surface-high)] hover:bg-[color:var(--color-carely-surface-low)] disabled:opacity-30"
                            disabled={!isPersisted || idx === orderedCategories.length - 1}
                            title="Move down"
                            onClick={async () => {
                              try {
                                const next = [...orderedCategories];
                                [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                                await reorderCategories({ orderedIds: next.map((x: any) => x.id) } as any);
                                toast.success('Order updated');
                                refetchCategories();
                              } catch (e: any) {
                                toast.error('Reorder failed: ' + (e?.message || 'Unknown error'));
                              }
                            }}
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-[color:var(--color-carely-surface-high)] text-red-600 hover:bg-red-50"
                            title="Delete category"
                            onClick={async () => {
                              await deleteCategory({ id: c.id } as any);
                              refetchCategories();
                            }}
                            disabled={!isPersisted}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <p className="text-xs font-jakarta text-[color:var(--color-carely-on-surface-variant)]">
                      {!isPersisted
                        ? 'Run the DB migration to enable add/edit/delete/reorder. Right now you are seeing fallback defaults.'
                        : 'Changes are saved globally and affect chips, stats, and the log form immediately.'}
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            <AddParentModal onCreated={refetch} />
          </div>
        </div>
        
        {parents && parents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {parents.map((parent: any) => (
              <ParentCard 
                key={parent.id} 
                parent={parent} 
                isOwner={parent.createdByUserId === user?.id} 
              />
            ))}
          </div>
        ) : (
          <div className="max-w-md mx-auto mt-16">
            <EmptyState 
              icon={Heart} 
              title="No patients yet" 
              description="Add a patient to start tracking vitals, medications, and health history in one place."
            />
          </div>
        )}
      </div>
    </div>
  );
}
