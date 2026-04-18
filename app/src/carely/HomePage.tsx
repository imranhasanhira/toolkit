import React, { useMemo, useState } from 'react';
import { useAction, useQuery, getCarelyParents, getCarelyVitalCategories, getCarelyAppSettings, updateCarelyAppSettings, upsertCarelyVitalCategory, deleteCarelyVitalCategory, reorderCarelyVitalCategories } from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import { GripVertical, Heart, Pencil, Plus, Settings, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ParentCard } from './components/ParentCard';
import { AddParentModal } from './components/AddParentModal';
import { EmptyState } from './components/EmptyState';
import { vitalDisplayName, vitalKindLabel } from './utils/vitalLabels';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../client/components/ui/dialog';
import { Input } from '../client/components/ui/input';
import { Label } from '../client/components/ui/label';
import { Checkbox } from '../client/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../client/components/ui/select';
import toast from 'react-hot-toast';

// A sortable row inside the vital-category list. The drag handle is the
// leftmost button (GripVertical) — only that button receives dnd-kit's
// listeners so the rest of the row (text, edit, delete) keeps normal
// click/tap behavior. `touch-none` on the handle is critical on mobile:
// without it, the browser claims the touch as a scroll gesture and the
// drag never starts.
function SortableCategoryRow({
  c,
  disabled,
  t,
  onEdit,
  onDelete,
}: {
  c: any;
  disabled: boolean;
  t: TFunction;
  onEdit: (c: any) => void;
  onDelete: (c: any) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: c.id,
    disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    opacity: isDragging ? 0.85 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      // Single-line layout: text on the left (truncates when tight),
      // drag handle + edit + delete grouped on the right so the row
      // stays compact at all viewport widths.
      className="flex items-center gap-2 rounded-xl border border-[color:var(--color-carely-surface-high)] bg-[color:var(--color-carely-surface-lowest)] px-3 py-2"
    >
      <div className="min-w-0 flex-1">
        <div className="font-jakarta font-semibold text-sm text-[color:var(--color-carely-on-surface)] truncate">
          {vitalDisplayName(t, c)}
        </div>
        <div className="text-xs font-jakarta text-[color:var(--color-carely-on-surface-variant)] truncate">
          {c.key} · {vitalKindLabel(t, c.kind)}{c.unit ? ` · ${c.unit}` : ''}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          className="h-8 w-8 inline-flex touch-none items-center justify-center rounded-xl border border-[color:var(--color-carely-surface-high)] text-[color:var(--color-carely-on-surface-variant)] hover:bg-[color:var(--color-carely-surface-low)] disabled:opacity-30 cursor-grab active:cursor-grabbing"
          title={t('home.settings.categories.actions.dragToReorder')}
          aria-label={t('home.settings.categories.actions.dragToReorder')}
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="h-8 w-8 inline-flex items-center justify-center rounded-xl border border-[color:var(--color-carely-surface-high)] hover:bg-[color:var(--color-carely-surface-low)] disabled:opacity-30"
          disabled={disabled}
          title={t('home.settings.categories.actions.editTooltip')}
          onClick={() => onEdit(c)}
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="h-8 w-8 inline-flex items-center justify-center rounded-xl border border-[color:var(--color-carely-surface-high)] text-red-600 hover:bg-red-50 disabled:opacity-30"
          title={t('home.settings.categories.actions.deleteTooltip')}
          onClick={() => onDelete(c)}
          disabled={disabled}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function CarelyHomePage() {
  const { data: user } = useAuth();
  const { t } = useTranslation('carely');
  const { data: parents, isLoading, refetch } = useQuery(getCarelyParents);
  const { data: categories = [], refetch: refetchCategories } = useQuery(getCarelyVitalCategories);
  const { data: appSettings, refetch: refetchAppSettings } = useQuery(getCarelyAppSettings);
  const updateAppSettings = useAction(updateCarelyAppSettings);
  const upsertCategory = useAction(upsertCarelyVitalCategory);
  const deleteCategory = useAction(deleteCarelyVitalCategory);
  const reorderCategories = useAction(reorderCarelyVitalCategories);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // After a drop, dnd-kit clears its drag transform immediately, but the
  // server roundtrip + refetch takes ~100ms. Without a local override, the
  // row snaps back to its old sortOrder for one frame and then jumps to the
  // new position — the "flick" users see. `optimisticOrder` holds the
  // post-drop ordering until the refetched data reflects it.
  const [optimisticOrder, setOptimisticOrder] = useState<string[] | null>(null);

  const orderedCategories = useMemo(() => {
    const sorted = [...categories].sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    if (!optimisticOrder) return sorted;
    const byId = new Map(sorted.map((c: any) => [c.id, c]));
    const result: any[] = [];
    for (const id of optimisticOrder) {
      const row = byId.get(id);
      if (row) result.push(row);
    }
    // Any category that appeared after the optimistic snapshot (e.g. a
    // concurrent add) lands at the end rather than being dropped entirely.
    for (const c of sorted as any[]) {
      if (!optimisticOrder.includes(c.id)) result.push(c);
    }
    return result;
  }, [categories, optimisticOrder]);

  const EMPTY_DRAFT: {
    key: string;
    displayName: string;
    kind: 'numeric' | 'blood_pressure';
    unit: string;
    isActive: boolean;
  } = { key: '', displayName: '', kind: 'numeric', unit: '', isActive: true };

  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const isPersisted =
    orderedCategories.every((c: any) => !String(c.id).startsWith('__default__')) &&
    !String((appSettings as any)?.id ?? '').startsWith('__default__');

  const openAddCategoryDialog = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setCategoryFormOpen(true);
  };

  const openEditCategoryDialog = (c: any) => {
    setEditingId(c.id);
    setDraft({
      key: c.key ?? '',
      displayName: c.displayName ?? '',
      kind: (c.kind as 'numeric' | 'blood_pressure') ?? 'numeric',
      unit: c.unit ?? '',
      isActive: c.isActive !== false,
    });
    setCategoryFormOpen(true);
  };

  const closeCategoryDialog = () => {
    setCategoryFormOpen(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  };

  const submitCategoryForm = async () => {
    try {
      await upsertCategory({
        ...(editingId ? { id: editingId } : {}),
        key: draft.key,
        displayName: draft.displayName,
        kind: draft.kind,
        unit: draft.unit || null,
        isActive: draft.isActive,
      } as any);
      closeCategoryDialog();
      refetchCategories();
    } catch (e: any) {
      toast.error(e?.message || t('home.settings.categories.toasts.unknownError'));
    }
  };

  // dnd-kit sensors.
  // - PointerSensor with a 4px activation distance avoids hijacking a plain
  //   click on the drag handle.
  // - TouchSensor uses a 150ms delay + 6px tolerance so long-press initiates
  //   drag on mobile without conflicting with page scroll elsewhere.
  // - KeyboardSensor gives Space/Enter + arrow-key reordering for a11y.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids: string[] = orderedCategories.map((x: any) => x.id);
    const oldIdx = ids.indexOf(String(active.id));
    const newIdx = ids.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    const nextIds = arrayMove(ids, oldIdx, newIdx);

    // Lock the new order in locally BEFORE awaiting the server so the row
    // stays visually at its dropped position instead of snapping back to
    // the stale `sortOrder` from the query cache.
    setOptimisticOrder(nextIds);

    try {
      await reorderCategories({ orderedIds: nextIds } as any);
      // Wait for the refetch to resolve before releasing the override —
      // clearing earlier would reveal a 1-frame gap with the pre-drop order.
      await refetchCategories();
      setOptimisticOrder(null);
      toast.success(t('home.settings.categories.toasts.orderUpdated'));
    } catch (err: any) {
      setOptimisticOrder(null);
      toast.error(
        t('home.settings.categories.toasts.reorderFailed', {
          reason: err?.message || t('home.settings.categories.toasts.unknownError'),
        }),
      );
    }
  };

  if (isLoading) return <div className="flex h-[50vh] items-center justify-center font-jakarta text-[color:var(--color-carely-on-surface-variant)]">{t('home.loadingOverview')}</div>;

  return (
    <div className="min-h-screen bg-[color:var(--color-carely-surface)] px-4 py-8 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-8 sm:flex-nowrap sm:items-center">
          {/* On mobile: title + greeting claim the full width so the long
              Bengali greeting wraps naturally. On sm+ the actions sit inline
              on the right again. */}
          <div className="min-w-0 w-full sm:w-auto sm:flex-1">
            <h1 className="font-lexend text-3xl font-bold text-[color:var(--color-carely-on-surface)]">{t('home.title')}</h1>
            <p className="font-jakarta text-[color:var(--color-carely-on-surface-variant)] mt-1">{t('home.greeting', { name: user?.username || t('home.defaultCaregiver') })}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 ml-auto">
            {user?.isAdmin && (
              <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogTrigger asChild>
                  <button
                    className="h-10 w-10 inline-flex items-center justify-center rounded-xl bg-[color:var(--color-carely-surface-lowest)] border border-[color:var(--color-carely-surface-high)] text-[color:var(--color-carely-on-surface-variant)] hover:bg-[color:var(--color-carely-surface-low)] transition-colors shadow-xs"
                    title={t('home.openSettings')}
                    type="button"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg bg-[color:var(--color-carely-surface-lowest)] border-[color:var(--color-carely-surface-high)] rounded-2xl">
                  <DialogHeader>
                    <DialogTitle className="font-lexend text-[color:var(--color-carely-on-surface)] text-lg">
                      {t('home.settings.title')}
                    </DialogTitle>
                  </DialogHeader>

                  <div className="mt-3 space-y-3">
                    <div className="rounded-xl border border-[color:var(--color-carely-surface-high)] bg-[color:var(--color-carely-surface-low)] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3 sm:flex-nowrap">
                        <div className="min-w-0 flex-1">
                          <div className="font-jakarta font-semibold text-sm text-[color:var(--color-carely-on-surface)]">
                            {t('home.settings.temperature.title')}
                          </div>
                          <div className="text-xs font-jakarta text-[color:var(--color-carely-on-surface-variant)]">
                            {t('home.settings.temperature.description')}
                          </div>
                        </div>
                        <Select
                          value={(appSettings as any)?.temperatureUnit === 'C' ? 'C' : 'F'}
                          onValueChange={async (v) => {
                            await updateAppSettings({ temperatureUnit: (v === 'C' ? 'C' : 'F') } as any);
                            refetchAppSettings();
                          }}
                          disabled={!isPersisted}
                        >
                          <SelectTrigger className="h-10 w-full gap-3 bg-[color:var(--color-carely-surface-lowest)] border border-[color:var(--color-carely-surface-high)] rounded-xl px-3 font-jakarta text-[color:var(--color-carely-on-surface)] shadow-none sm:w-auto sm:min-w-[11rem]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="F">{t('home.settings.temperature.fahrenheit')}</SelectItem>
                            <SelectItem value="C">{t('home.settings.temperature.celsius')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {!isPersisted && (
                        <p className="mt-2 text-xs font-jakarta text-[color:var(--color-carely-on-surface-variant)]">
                          {t('home.settings.temperature.dbMigrationPrompt')}
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl border border-[color:var(--color-carely-surface-high)] bg-[color:var(--color-carely-surface-low)] p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="font-lexend font-semibold text-[color:var(--color-carely-on-surface)]">
                          {t('home.settings.categories.title')}
                        </div>
                        <button
                          type="button"
                          className="h-9 inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[color:var(--color-carely-primary)] text-white px-3 font-jakarta font-semibold text-sm shadow-xs hover:opacity-90 disabled:opacity-30"
                          onClick={openAddCategoryDialog}
                          disabled={!isPersisted}
                        >
                          <Plus className="w-4 h-4" />
                          <span>{t('home.settings.categories.actions.addCategory')}</span>
                        </button>
                      </div>
                      <p className="text-xs font-jakarta text-[color:var(--color-carely-on-surface-variant)]">
                        {!isPersisted
                          ? t('home.settings.categories.footer.migrationNeeded')
                          : t('home.settings.categories.footer.livePersistence')}
                      </p>
                    </div>

                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={orderedCategories.map((c: any) => c.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {orderedCategories.map((c: any) => (
                            <SortableCategoryRow
                              key={c.id}
                              c={c}
                              disabled={!isPersisted}
                              t={t}
                              onEdit={openEditCategoryDialog}
                              onDelete={async (cat: any) => {
                                await deleteCategory({ id: cat.id } as any);
                                refetchCategories();
                              }}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            <AddParentModal onCreated={refetch} />
          </div>
        </div>

        {user?.isAdmin && (
          <Dialog
            open={categoryFormOpen}
            onOpenChange={(open) => {
              if (!open) closeCategoryDialog();
            }}
          >
            <DialogContent className="sm:max-w-lg bg-[color:var(--color-carely-surface-lowest)] border-[color:var(--color-carely-surface-high)] rounded-2xl">
              <DialogHeader>
                <DialogTitle className="font-lexend text-[color:var(--color-carely-on-surface)] text-lg">
                  {editingId
                    ? t('home.settings.categories.dialog.editTitle')
                    : t('home.settings.categories.dialog.addTitle')}
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('home.settings.categories.labels.key')}</Label>
                  <Input
                    value={draft.key}
                    onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))}
                    placeholder={t('home.settings.categories.placeholders.key')}
                  />
                  {editingId && (
                    <p className="text-xs font-jakarta text-[color:var(--color-carely-on-surface-variant)]">
                      {t('home.settings.categories.hints.keyRename')}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>{t('home.settings.categories.labels.name')}</Label>
                  <Input
                    value={draft.displayName}
                    onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
                    placeholder={t('home.settings.categories.placeholders.name')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('home.settings.categories.labels.kind')}</Label>
                  <Select
                    value={draft.kind}
                    onValueChange={(v) => setDraft((d) => ({ ...d, kind: v as 'numeric' | 'blood_pressure' }))}
                  >
                    <SelectTrigger className="h-10 w-full bg-[color:var(--color-carely-surface-lowest)] border border-[color:var(--color-carely-surface-high)] rounded-xl px-3 font-jakarta text-[color:var(--color-carely-on-surface)] shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="numeric">{t('home.settings.categories.kind.numeric')}</SelectItem>
                      <SelectItem value="blood_pressure">{t('home.settings.categories.kind.bloodPressure')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('home.settings.categories.labels.unit')}</Label>
                  <Input
                    value={draft.unit}
                    onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
                    placeholder={t('home.settings.categories.placeholders.unit')}
                  />
                </div>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Checkbox
                    checked={draft.isActive}
                    onCheckedChange={(v) => setDraft((d) => ({ ...d, isActive: !!v }))}
                    id="carely-cat-active"
                  />
                  <Label htmlFor="carely-cat-active">{t('home.settings.categories.labels.active')}</Label>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="h-10 inline-flex items-center justify-center rounded-xl bg-[color:var(--color-carely-surface-lowest)] border border-[color:var(--color-carely-surface-high)] text-[color:var(--color-carely-on-surface-variant)] px-4 font-jakarta font-semibold text-sm hover:bg-[color:var(--color-carely-surface-low)] transition-colors"
                  onClick={closeCategoryDialog}
                >
                  {t('home.settings.categories.actions.cancel')}
                </button>
                <button
                  type="button"
                  className="h-10 inline-flex items-center justify-center rounded-xl bg-[color:var(--color-carely-primary)] text-white px-4 font-jakarta font-semibold shadow-xs hover:opacity-90 text-sm whitespace-normal text-center leading-tight disabled:opacity-30"
                  onClick={submitCategoryForm}
                  disabled={!isPersisted || !draft.key.trim() || !draft.displayName.trim()}
                >
                  {editingId
                    ? t('home.settings.categories.actions.saveChanges')
                    : t('home.settings.categories.actions.addCategory')}
                </button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        
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
              title={t('home.empty.title')}
              description={t('home.empty.description')}
            />
          </div>
        )}
      </div>
    </div>
  );
}
