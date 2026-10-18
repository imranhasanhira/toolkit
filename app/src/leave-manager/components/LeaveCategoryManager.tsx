import React, { useState } from 'react';
import { ArchiveBoxIcon, ArrowUpTrayIcon, DocumentDuplicateIcon, PencilIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { pickUnusedCategoryColor } from '../colors';
import { GovernmentHoliday, LeaveCategory, LeaveDate, LeaveScope } from '../types';
import { ColorSwatchPicker } from './ColorSwatchPicker';

interface HolidayInput {
  startDate: string;
  endDate: string | null;
  name: string;
  description?: string;
  scope: LeaveScope;
}

interface LeaveCategoryManagerProps {
  categories: LeaveCategory[];
  leaveDates: LeaveDate[];
  governmentHolidays: GovernmentHoliday[];
  onAddCategory: (name: string, color: string, startDate: string, endDate: string | null, quota: number, scope: LeaveScope) => void;
  onEditCategory: (id: string, name: string, color: string, startDate: string, endDate: string | null, quota: number) => void;
  onDeleteCategory: (id: string) => void;
  onArchiveCategory: (id: string) => void;
  onUnarchiveCategory: (id: string) => void;
  onAddGovernmentHoliday: (input: HolidayInput) => void;
  onDeleteGovernmentHoliday: (id: string) => void;
}

const fieldClass = 'w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

function ScopePicker({ value, onChange }: { value: LeaveScope; onChange: (scope: LeaveScope) => void }) {
  const option = (scope: LeaveScope, label: string) => (
    <button
      type="button"
      onClick={() => onChange(scope)}
      className={`rounded px-2 py-1 ${value === scope ? 'bg-gray-900 text-white' : 'border border-gray-300 bg-white text-gray-700'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex gap-1 text-[11px]">
      {option('project', 'This project')}
      {option('global', 'All projects')}
    </div>
  );
}

function AllBadge() {
  return <span className="shrink-0 rounded bg-gray-200 px-1 text-[10px] font-medium text-gray-600">All</span>;
}

export const LeaveCategoryManager: React.FC<LeaveCategoryManagerProps> = ({
  categories,
  leaveDates,
  governmentHolidays,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onArchiveCategory,
  onUnarchiveCategory,
  onAddGovernmentHoliday,
  onDeleteGovernmentHoliday,
}) => {
  const activeCategories = categories.filter((category) => !category.isArchived);
  const archivedCategories = categories.filter((category) => category.isArchived);

  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#2563EB');
  const [newCategoryStartDate, setNewCategoryStartDate] = useState('');
  const [newCategoryEndDate, setNewCategoryEndDate] = useState('');
  const [newCategoryQuota, setNewCategoryQuota] = useState(20);
  const [newCategoryScope, setNewCategoryScope] = useState<LeaveScope>('project');

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingCategoryColor, setEditingCategoryColor] = useState('#2563EB');
  const [editingCategoryStartDate, setEditingCategoryStartDate] = useState('');
  const [editingCategoryEndDate, setEditingCategoryEndDate] = useState('');
  const [editingCategoryQuota, setEditingCategoryQuota] = useState(20);

  const [isAddingHoliday, setIsAddingHoliday] = useState(false);
  const [holidayStart, setHolidayStart] = useState('');
  const [holidayEnd, setHolidayEnd] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [holidayDescription, setHolidayDescription] = useState('');
  const [holidayScope, setHolidayScope] = useState<LeaveScope>('project');
  const [showArchived, setShowArchived] = useState(false);

  const usedActiveColors = () => activeCategories.map((category) => category.color);

  const resetAddForm = () => {
    setNewCategoryName('');
    setNewCategoryColor(pickUnusedCategoryColor(usedActiveColors()));
    setNewCategoryStartDate('');
    setNewCategoryEndDate('');
    setNewCategoryQuota(20);
    setNewCategoryScope('project');
  };

  const openAddCategory = () => {
    resetAddForm();
    setIsAddingCategory(true);
    setEditingCategoryId(null);
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim() || !newCategoryStartDate || newCategoryQuota <= 0) return;
    onAddCategory(
      newCategoryName.trim(),
      newCategoryColor,
      newCategoryStartDate,
      newCategoryEndDate.trim() ? newCategoryEndDate : null,
      newCategoryQuota,
      newCategoryScope
    );
    setIsAddingCategory(false);
    resetAddForm();
  };

  const handleStartEdit = (category: LeaveCategory) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
    setEditingCategoryColor(category.color);
    setEditingCategoryStartDate(category.startDate);
    setEditingCategoryEndDate(category.endDate ?? '');
    setEditingCategoryQuota(category.quota);
    setIsAddingCategory(false);
  };

  const handleEditCategory = () => {
    if (!editingCategoryId || !editingCategoryName.trim() || !editingCategoryStartDate || editingCategoryQuota <= 0) return;
    onEditCategory(
      editingCategoryId,
      editingCategoryName.trim(),
      editingCategoryColor,
      editingCategoryStartDate,
      editingCategoryEndDate.trim() ? editingCategoryEndDate : null,
      editingCategoryQuota
    );
    setEditingCategoryId(null);
  };

  const handleDuplicateCategory = (category: LeaveCategory) => {
    setNewCategoryName(`${category.name} (Copy)`);
    setNewCategoryColor(pickUnusedCategoryColor(usedActiveColors()));
    setNewCategoryStartDate(category.startDate);
    setNewCategoryEndDate(category.endDate ?? '');
    setNewCategoryQuota(category.quota);
    setNewCategoryScope(category.projectId ? 'project' : 'global');
    setIsAddingCategory(true);
    setEditingCategoryId(null);
  };

  const handleAddHoliday = () => {
    if (!holidayStart || !holidayName.trim()) return;
    onAddGovernmentHoliday({
      startDate: holidayStart,
      endDate: holidayEnd.trim() ? holidayEnd : null,
      name: holidayName.trim(),
      description: holidayDescription.trim() || undefined,
      scope: holidayScope,
    });
    setHolidayScope('project');
    setHolidayStart('');
    setHolidayEnd('');
    setHolidayName('');
    setHolidayDescription('');
    setIsAddingHoliday(false);
  };

  const usedDays = (categoryId: string) => leaveDates.filter((leaveDate) => leaveDate.categoryId === categoryId).length;

  return (
    <div className="rounded-lg bg-white p-3 shadow">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Categories</h2>
        <button
          type="button"
          onClick={openAddCategory}
          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Add
        </button>
      </div>

      {isAddingCategory && (
        <div className="mb-3 space-y-2 rounded-md border border-gray-200 bg-gray-50 p-2">
          <input className={fieldClass} type="text" placeholder="Name" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} />
          <ColorSwatchPicker value={newCategoryColor} onChange={setNewCategoryColor} />
          <div className="grid grid-cols-2 gap-2">
            <input className={fieldClass} type="date" value={newCategoryStartDate} onChange={(event) => setNewCategoryStartDate(event.target.value)} />
            <input className={fieldClass} type="date" value={newCategoryEndDate} onChange={(event) => setNewCategoryEndDate(event.target.value)} title="End date (empty = open-ended)" />
          </div>
          <input className={fieldClass} type="number" min={1} value={newCategoryQuota} onChange={(event) => setNewCategoryQuota(parseInt(event.target.value, 10) || 0)} />
          <ScopePicker value={newCategoryScope} onChange={setNewCategoryScope} />
          <p className="text-[11px] text-gray-500">The same name can exist in another project with its own dates.</p>
          <div className="flex gap-2">
            <button type="button" onClick={handleAddCategory} className="rounded-md bg-green-600 px-2 py-1 text-xs text-white">Add</button>
            <button type="button" onClick={() => setIsAddingCategory(false)} className="rounded-md bg-gray-500 px-2 py-1 text-xs text-white">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-1">
        {activeCategories.map((category) => (
          <div key={category.id} className="rounded-md bg-gray-50 px-2 py-1">
            {editingCategoryId === category.id ? (
              <div className="space-y-2 py-1">
                <input className={fieldClass} type="text" value={editingCategoryName} onChange={(event) => setEditingCategoryName(event.target.value)} />
                <ColorSwatchPicker value={editingCategoryColor} onChange={setEditingCategoryColor} />
                <div className="grid grid-cols-2 gap-2">
                  <input className={fieldClass} type="date" value={editingCategoryStartDate} onChange={(event) => setEditingCategoryStartDate(event.target.value)} />
                  <input className={fieldClass} type="date" value={editingCategoryEndDate} onChange={(event) => setEditingCategoryEndDate(event.target.value)} title="End date (empty = open-ended)" />
                </div>
                <input className={fieldClass} type="number" min={1} value={editingCategoryQuota} onChange={(event) => setEditingCategoryQuota(parseInt(event.target.value, 10) || 0)} />
                <div className="flex gap-2">
                  <button type="button" onClick={handleEditCategory} className="rounded bg-green-600 px-2 py-1 text-xs text-white">Save</button>
                  <button type="button" onClick={() => setEditingCategoryId(null)} className="rounded bg-gray-500 px-2 py-1 text-xs text-white">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                <span className="min-w-0 flex-1 truncate text-sm text-gray-900" title={`${category.projectId ? 'This project' : 'All projects'} · ${category.startDate} to ${category.endDate ?? '∞'}`}>
                  {category.name}
                </span>
                {category.projectId == null && <AllBadge />}
                <span className="shrink-0 text-[11px] text-gray-500">{usedDays(category.id)}/{category.quota}</span>
                <button type="button" onClick={() => handleDuplicateCategory(category)} className="p-1 text-gray-400 hover:text-blue-600" title="Duplicate">
                  <DocumentDuplicateIcon className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => handleStartEdit(category)} className="p-1 text-gray-400 hover:text-gray-700" title="Edit">
                  <PencilIcon className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => onArchiveCategory(category.id)} className="p-1 text-gray-400 hover:text-yellow-700" title="Archive">
                  <ArchiveBoxIcon className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => onDeleteCategory(category.id)} className="p-1 text-gray-400 hover:text-red-600" title="Delete">
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-gray-100 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Holidays ({governmentHolidays.length})</h3>
          <button
            type="button"
            onClick={() => {
              setHolidayScope('project');
              setIsAddingHoliday(true);
            }}
            className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Add
          </button>
        </div>

        {isAddingHoliday && (
          <div className="mb-2 space-y-2 rounded-md border border-red-200 bg-red-50 p-2">
            <input className={fieldClass} type="text" placeholder="Holiday name" value={holidayName} onChange={(event) => setHolidayName(event.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input className={fieldClass} type="date" value={holidayStart} onChange={(event) => setHolidayStart(event.target.value)} title="Start date" />
              <input className={fieldClass} type="date" value={holidayEnd} onChange={(event) => setHolidayEnd(event.target.value)} title="End date (empty = one day)" />
            </div>
            <input className={fieldClass} type="text" placeholder="Description (optional)" value={holidayDescription} onChange={(event) => setHolidayDescription(event.target.value)} />
            <ScopePicker value={holidayScope} onChange={setHolidayScope} />
            <p className="text-[11px] text-red-700">
              {holidayScope === 'global'
                ? 'All projects. A range includes every date, including weekends.'
                : 'This project only. A range includes every date, including weekends.'}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={handleAddHoliday} className="rounded-md bg-red-600 px-2 py-1 text-xs text-white">Add holiday</button>
              <button type="button" onClick={() => setIsAddingHoliday(false)} className="rounded-md bg-gray-500 px-2 py-1 text-xs text-white">Cancel</button>
            </div>
          </div>
        )}

        <div className="max-h-40 space-y-1 overflow-y-auto">
          {governmentHolidays.map((holiday) => (
            <div key={holiday.id} className="flex items-center gap-2 rounded border border-red-100 bg-red-50 px-2 py-1">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <div className="truncate text-xs font-medium text-red-900">{holiday.name}</div>
                  {holiday.projectId == null && <AllBadge />}
                </div>
                <div className="text-[11px] text-red-600">{holiday.date}</div>
                {holiday.description && <div className="truncate text-[11px] text-red-500">{holiday.description}</div>}
              </div>
              <button
                type="button"
                onClick={() => onDeleteGovernmentHoliday(holiday.id)}
                className="rounded p-1.5 text-red-500 hover:bg-red-100 hover:text-red-700"
                aria-label={`Delete ${holiday.name}`}
                title="Delete holiday"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {archivedCategories.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={() => setShowArchived((open) => !open)}
            className="text-xs font-medium text-gray-500 hover:text-gray-800"
          >
            Archived categories ({archivedCategories.length}) {showArchived ? '▾' : '▸'}
          </button>
          {showArchived && (
            <div className="mt-1 space-y-1">
              {archivedCategories.map((category) => (
                <div key={category.id} className="flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-gray-600">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                  <span className="min-w-0 flex-1 truncate text-xs">{category.name}</span>
                  {category.projectId == null && <AllBadge />}
                  <span className="text-[11px] text-gray-500">{usedDays(category.id)}/{category.quota}</span>
                  <button type="button" onClick={() => onUnarchiveCategory(category.id)} className="p-1 text-gray-400 hover:text-green-700" title="Unarchive">
                    <ArrowUpTrayIcon className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => onDeleteCategory(category.id)} className="p-1 text-gray-400 hover:text-red-600" title="Delete">
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
