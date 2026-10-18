import React, { useState } from 'react';
import { ArchiveBoxIcon, ArrowUpTrayIcon, PencilIcon, PlusIcon } from '@heroicons/react/24/outline';
import { LeaveProject } from '../types';
import { pickUnusedCategoryColor } from '../colors';
import { ColorSwatchPicker } from './ColorSwatchPicker';

interface ProjectManagerProps {
  projects: LeaveProject[];
  activeProjectId: string | null;
  onCreate: (name: string, color: string) => void;
  onUpdate: (id: string, name: string, color: string | null) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onSelect: (id: string) => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({
  projects,
  activeProjectId,
  onCreate,
  onUpdate,
  onArchive,
  onUnarchive,
  onSelect,
}) => {
  const activeProjects = projects.filter((project) => !project.isArchived);
  const archivedProjects = projects.filter((project) => project.isArchived);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#2563EB');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingColor, setEditingColor] = useState('#2563EB');
  const [showArchived, setShowArchived] = useState(false);

  const openAdd = () => {
    setNewColor(pickUnusedCategoryColor(activeProjects.map((project) => project.color || '')));
    setNewName('');
    setIsAdding(true);
    setEditingId(null);
  };

  const submitAdd = () => {
    if (!newName.trim()) return;
    onCreate(newName.trim(), newColor);
    setIsAdding(false);
    setNewName('');
  };

  const startEdit = (project: LeaveProject) => {
    setEditingId(project.id);
    setEditingName(project.name);
    setEditingColor(project.color || '#2563EB');
    setIsAdding(false);
  };

  const submitEdit = () => {
    if (!editingId || !editingName.trim()) return;
    onUpdate(editingId, editingName.trim(), editingColor);
    setEditingId(null);
  };

  return (
    <div className="mb-4 rounded-lg bg-white p-3 shadow">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Projects</h2>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-1 rounded-md bg-gray-900 px-2 py-1 text-xs text-white hover:bg-gray-700"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Add
        </button>
      </div>

      {isAdding && (
        <div className="mb-2 space-y-2 rounded-md border border-gray-200 p-2">
          <input
            type="text"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Project name"
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <ColorSwatchPicker value={newColor} onChange={setNewColor} />
          <div className="flex gap-2">
            <button type="button" onClick={submitAdd} className="rounded-md bg-green-600 px-2 py-1 text-xs text-white">
              Create
            </button>
            <button type="button" onClick={() => setIsAdding(false)} className="rounded-md bg-gray-500 px-2 py-1 text-xs text-white">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-1">
        {activeProjects.map((project) => (
          <div key={project.id} className="rounded-md bg-gray-50 px-2 py-1">
            {editingId === project.id ? (
              <div className="space-y-2 py-1">
                <input
                  type="text"
                  value={editingName}
                  onChange={(event) => setEditingName(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <ColorSwatchPicker value={editingColor} onChange={setEditingColor} />
                <div className="flex gap-2">
                  <button type="button" onClick={submitEdit} className="rounded bg-green-600 px-2 py-1 text-xs text-white">
                    Save
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="rounded bg-gray-500 px-2 py-1 text-xs text-white">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: project.color || '#2563EB' }}
                />
                <button
                  type="button"
                  onClick={() => onSelect(project.id)}
                  className={`min-w-0 flex-1 truncate text-left text-sm ${project.id === activeProjectId ? 'font-semibold text-gray-900' : 'text-gray-700 hover:text-gray-900'}`}
                  aria-current={project.id === activeProjectId ? 'true' : undefined}
                >
                  {project.name}
                </button>
                <button type="button" onClick={() => startEdit(project)} className="p-1 text-gray-400 hover:text-gray-700" title="Rename project">
                  <PencilIcon className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => onArchive(project.id)} className="p-1 text-gray-400 hover:text-yellow-700" title="Archive project">
                  <ArchiveBoxIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {archivedProjects.length > 0 && (
        <div className="mt-2 border-t border-gray-100 pt-2">
          <button
            type="button"
            onClick={() => setShowArchived((open) => !open)}
            className="text-xs font-medium text-gray-500 hover:text-gray-800"
          >
            Archived projects ({archivedProjects.length}) {showArchived ? '▾' : '▸'}
          </button>
          {showArchived && (
            <div className="mt-1 space-y-1">
              {archivedProjects.map((project) => (
                <div key={project.id} className="flex items-center gap-1.5 px-2 py-1 text-sm text-gray-500">
                  <span className="min-w-0 flex-1 truncate">{project.name}</span>
                  <button type="button" onClick={() => onUnarchive(project.id)} className="p-1 text-gray-400 hover:text-green-700" title="Unarchive project">
                    <ArrowUpTrayIcon className="h-3.5 w-3.5" />
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
