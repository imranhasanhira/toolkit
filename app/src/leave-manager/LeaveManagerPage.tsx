import React, { useEffect, useState } from 'react';
import { useQuery, useAction } from 'wasp/client/operations';
import {
  getLeaveProjects,
  createLeaveProject,
  updateLeaveProject,
  archiveLeaveProject,
  unarchiveLeaveProject,
  getLeaveCategories,
  getLeaveDays,
  getGovernmentHolidays,
  createLeaveCategory,
  updateLeaveCategory,
  deleteLeaveCategory,
  archiveLeaveCategory,
  unarchiveLeaveCategory,
  upsertLeaveDays,
  deleteLeaveDays,
  createGovernmentHolidays,
  deleteGovernmentHoliday,
} from 'wasp/client/operations';
import { Calendar } from './components/Calendar';
import { LeaveCategorySelector } from './components/LeaveCategorySelector';
import { LeaveCategoryManager } from './components/LeaveCategoryManager';
import { ProjectManager } from './components/ProjectManager';
import { GovernmentHoliday, LeaveCategory, LeaveDate, LeaveProject, MarkMode, RangeMode } from './types';
import { expandDateRange, formatDateString, isDateWithinRange, toDateString } from './dates';
import { isVisibleInProject } from './scope';
import type { LeaveScope } from './scope';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../client/components/ui/sheet';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import { ConfirmationDialog } from '../client/components/ui/confirmation-dialog';

const PROJECT_STORAGE_KEY = 'leave-manager.activeProjectId';

function defaultMarkMode(): MarkMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'single';
  const touchOnly = window.matchMedia('(pointer: coarse) and (hover: none)').matches;
  return touchOnly ? 'range' : 'single';
}

const Toast = ({ message, type, onClose }: { message: string; type: 'warning' | 'error' | 'success'; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'warning' ? 'bg-yellow-500' : type === 'error' ? 'bg-red-500' : 'bg-green-500';

  return (
    <div className={`fixed right-4 top-4 z-50 flex min-w-72 items-center gap-3 rounded-lg px-4 py-2 text-white shadow-lg ${bgColor}`}>
      <span className="flex-1 text-sm">{message}</span>
      <button type="button" onClick={onClose} className="text-lg text-white hover:text-gray-200">
        ×
      </button>
    </div>
  );
};

function readStoredProjectId(): string | null {
  try {
    return localStorage.getItem(PROJECT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredProjectId(projectId: string) {
  try {
    localStorage.setItem(PROJECT_STORAGE_KEY, projectId);
  } catch {
    // Ignore storage failures (private mode).
  }
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function mapCategory(category: {
  id: string;
  name: string;
  color: string;
  startDate: Date | string;
  endDate: Date | string | null;
  quota: number;
  isArchived: boolean;
  projectId: string | null;
}): LeaveCategory {
  return {
    id: category.id,
    name: category.name,
    color: category.color,
    startDate: toDateString(category.startDate) ?? '',
    endDate: toDateString(category.endDate),
    quota: category.quota,
    isArchived: category.isArchived,
    projectId: category.projectId,
  };
}

export const LeaveManagerPage: React.FC = () => {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [currentCategory, setCurrentCategory] = useState<LeaveCategory | null>(null);
  const [rangeMode, setRangeMode] = useState<RangeMode>('all');
  const [includeWeekends, setIncludeWeekends] = useState(false);
  const [markMode, setMarkMode] = useState<MarkMode>(defaultMarkMode);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'warning' | 'error' | 'success'>('warning');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  const createProjectFn = useAction(createLeaveProject);
  const updateProjectFn = useAction(updateLeaveProject);
  const archiveProjectFn = useAction(archiveLeaveProject);
  const unarchiveProjectFn = useAction(unarchiveLeaveProject);
  const createLeaveCategoryFn = useAction(createLeaveCategory);
  const updateLeaveCategoryFn = useAction(updateLeaveCategory);
  const deleteLeaveCategoryFn = useAction(deleteLeaveCategory);
  const archiveLeaveCategoryFn = useAction(archiveLeaveCategory);
  const unarchiveLeaveCategoryFn = useAction(unarchiveLeaveCategory);
  const upsertLeaveDaysFn = useAction(upsertLeaveDays);
  const deleteLeaveDaysFn = useAction(deleteLeaveDays);
  const createGovernmentHolidaysFn = useAction(createGovernmentHolidays);
  const deleteGovernmentHolidayFn = useAction(deleteGovernmentHoliday);

  const { data: projectsRaw = [], isLoading: projectsLoading, refetch: refetchProjects } = useQuery(getLeaveProjects);
  const projectReady = Boolean(activeProjectId);
  const projectArgs = { projectId: activeProjectId ?? '' };
  const {
    data: categoriesRaw = [],
    isLoading: categoriesLoading,
    refetch: refetchCategories,
  } = useQuery(getLeaveCategories, projectArgs, { enabled: projectReady });
  const {
    data: leaveDays = [],
    isLoading: leaveDaysLoading,
    refetch: refetchLeaveDays,
  } = useQuery(getLeaveDays, projectArgs, { enabled: projectReady });
  const {
    data: holidaysRaw = [],
    isLoading: holidaysLoading,
    refetch: refetchHolidays,
  } = useQuery(getGovernmentHolidays, projectArgs, { enabled: projectReady });

  const projects: LeaveProject[] = projectsRaw.map((project) => ({
    id: project.id,
    name: project.name,
    color: project.color,
    isArchived: project.isArchived,
  }));

  const categories: LeaveCategory[] = categoriesRaw
    .filter((category) => activeProjectId != null && isVisibleInProject(category.projectId, activeProjectId))
    .map(mapCategory)
    .sort((a, b) => {
      const aEnd = a.endDate ?? '9999-12-31';
      const bEnd = b.endDate ?? '9999-12-31';
      if (aEnd !== bEnd) return aEnd < bEnd ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const leaveDates: LeaveDate[] = leaveDays
    .filter((leaveDay) => leaveDay.projectId === activeProjectId)
    .map((leaveDay) => ({
      date: leaveDay.dateString,
      categoryId: leaveDay.categoryId,
    }));

  const governmentHolidays: GovernmentHoliday[] = holidaysRaw
    .filter((holiday) => activeProjectId != null && isVisibleInProject(holiday.projectId, activeProjectId))
    .map((holiday) => ({
      id: holiday.id,
      date: holiday.dateString,
      name: holiday.name,
      description: holiday.description,
      projectId: holiday.projectId,
    }))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date > b.date ? -1 : 1;
      if (a.projectId && !b.projectId) return -1;
      if (!a.projectId && b.projectId) return 1;
      return 0;
    });

  useEffect(() => {
    if (projectsLoading) return;
    const known = activeProjectId ? projects.some((project) => project.id === activeProjectId) : false;
    if (known) return;

    const active = projects.filter((project) => !project.isArchived);
    const storedId = readStoredProjectId();
    const next =
      active.find((project) => project.id === storedId) ??
      active.find((project) => project.name === 'Default') ??
      active[0] ??
      null;
    if (!next) return;
    writeStoredProjectId(next.id);
    setActiveProjectId(next.id);
    setCurrentCategory(null);
  }, [projectsRaw, projectsLoading, activeProjectId]);

  useEffect(() => {
    setCurrentCategory((current) => {
      if (!current) return null;
      const fresh = categories.find((category) => category.id === current.id);
      if (!fresh || fresh.isArchived) return null;
      if (
        fresh.name === current.name &&
        fresh.color === current.color &&
        fresh.startDate === current.startDate &&
        fresh.endDate === current.endDate &&
        fresh.quota === current.quota
      ) {
        return current;
      }
      return fresh;
    });
  }, [categories]);

  const showToastMessage = (message: string, type: 'warning' | 'error' | 'success' = 'warning') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
  };

  const selectProject = (projectId: string) => {
    writeStoredProjectId(projectId);
    setActiveProjectId(projectId);
    setCurrentCategory(null);
  };

  const requireProjectId = () => {
    if (!activeProjectId) {
      showToastMessage('Select a project first.', 'warning');
      return null;
    }
    return activeProjectId;
  };

  const handleDateToggle = async (date: Date) => {
    const projectId = requireProjectId();
    if (!projectId || !currentCategory) {
      showToastMessage('Select a leave category before marking dates.', 'warning');
      return;
    }

    const dateString = formatDateString(date);

    if (governmentHolidays.some((holiday) => holiday.date === dateString)) return;

    if (!isDateWithinRange(dateString, currentCategory.startDate, currentCategory.endDate)) {
      showToastMessage(
        `Date is outside the category date range (${currentCategory.startDate} to ${currentCategory.endDate ?? 'open-ended'}).`,
        'error'
      );
      return;
    }

    try {
      const alreadyMarked = leaveDates.some(
        (leaveDate) => leaveDate.date === dateString && leaveDate.categoryId === currentCategory.id
      );
      if (alreadyMarked) {
        await deleteLeaveDaysFn({ dates: [dateString], projectId, categoryId: currentCategory.id });
        showToastMessage(`${currentCategory.name} removed.`, 'success');
      } else {
        const categoryUsedDays = leaveDates.filter((leaveDate) => leaveDate.categoryId === currentCategory.id).length;
        if (categoryUsedDays >= currentCategory.quota) {
          showToastMessage(`Quota exceeded. Used ${categoryUsedDays}/${currentCategory.quota} days.`, 'warning');
        }
        await upsertLeaveDaysFn({ dates: [dateString], categoryId: currentCategory.id, projectId });
        const exceeded = categoryUsedDays >= currentCategory.quota;
        showToastMessage(
          exceeded
            ? `Marked as ${currentCategory.name} (quota exceeded: ${categoryUsedDays + 1}/${currentCategory.quota}).`
            : `Marked as ${currentCategory.name}.`,
          exceeded ? 'warning' : 'success'
        );
      }
      refetchLeaveDays();
    } catch (error) {
      showToastMessage(errorText(error, 'Could not update that date.'), 'error');
    }
  };

  const handleDateRangeToggle = async (startDate: Date, endDate: Date) => {
    const projectId = requireProjectId();
    if (!projectId || !currentCategory) {
      showToastMessage('Select a leave category before marking dates.', 'warning');
      return;
    }

    const datesToToggle = expandDateRange(startDate, endDate, {
      mode: rangeMode,
      skipWeekends: !includeWeekends,
      holidayDateStrings: governmentHolidays.map((holiday) => holiday.date),
    }).filter((dateString) => isDateWithinRange(dateString, currentCategory.startDate, currentCategory.endDate));

    if (datesToToggle.length === 0) {
      showToastMessage(includeWeekends ? 'No matching days in that range.' : 'No matching weekdays in that range.', 'warning');
      return;
    }

    try {
      const allDatesMarked = datesToToggle.every((dateString) =>
        leaveDates.some((leaveDate) => leaveDate.date === dateString && leaveDate.categoryId === currentCategory.id)
      );

      if (allDatesMarked) {
        await deleteLeaveDaysFn({ dates: datesToToggle, projectId, categoryId: currentCategory.id });
        showToastMessage(`${datesToToggle.length} ${currentCategory.name} dates removed.`, 'success');
      } else {
        const alreadyThisCategory = new Set(
          leaveDates
            .filter((leaveDate) => leaveDate.categoryId === currentCategory.id)
            .map((leaveDate) => leaveDate.date)
        );
        const newDates = datesToToggle.filter((dateString) => !alreadyThisCategory.has(dateString));
        if (newDates.length === 0) {
          showToastMessage(`Those days already include ${currentCategory.name}.`, 'warning');
          return;
        }

        const categoryUsedDays = leaveDates.filter((leaveDate) => leaveDate.categoryId === currentCategory.id).length;
        const willExceed = categoryUsedDays + newDates.length > currentCategory.quota;
        await upsertLeaveDaysFn({ dates: newDates, categoryId: currentCategory.id, projectId });
        const finalUsed = categoryUsedDays + newDates.length;
        showToastMessage(
          willExceed
            ? `${newDates.length} dates marked as ${currentCategory.name} (quota exceeded: ${finalUsed}/${currentCategory.quota}).`
            : `${newDates.length} dates marked as ${currentCategory.name}.`,
          willExceed ? 'warning' : 'success'
        );
      }
      refetchLeaveDays();
    } catch (error) {
      showToastMessage(errorText(error, 'Could not update that range.'), 'error');
    }
  };

  const handleAddCategory = async (
    name: string,
    color: string,
    startDate: string,
    endDate: string | null,
    quota: number,
    scope: LeaveScope
  ) => {
    const projectId = requireProjectId();
    if (!projectId) return;
    try {
      const created = await createLeaveCategoryFn({ projectId, name, color, startDate, endDate, quota, scope });
      setCurrentCategory(mapCategory(created));
      showToastMessage(scope === 'global' ? 'Category added for all projects.' : 'Category added.', 'success');
      refetchCategories();
      setMobileSidebarOpen(false);
    } catch (error) {
      showToastMessage(errorText(error, 'Could not add category.'), 'error');
    }
  };

  const handleEditCategory = async (
    id: string,
    name: string,
    color: string,
    startDate: string,
    endDate: string | null,
    quota: number
  ) => {
    const projectId = requireProjectId();
    if (!projectId) return;
    try {
      await updateLeaveCategoryFn({ id, projectId, name, color, startDate, endDate, quota });
      showToastMessage('Category updated.', 'success');
      refetchCategories();
      setMobileSidebarOpen(false);
    } catch (error) {
      showToastMessage(errorText(error, 'Could not update category.'), 'error');
    }
  };

  const confirmDeleteCategory = async () => {
    const projectId = requireProjectId();
    if (!projectId || !categoryToDelete) return;
    const id = categoryToDelete;
    try {
      await deleteLeaveCategoryFn({ id, projectId });
      if (currentCategory?.id === id) setCurrentCategory(null);
      showToastMessage('Category deleted.', 'success');
      refetchCategories();
      refetchLeaveDays();
      setMobileSidebarOpen(false);
    } catch (error) {
      showToastMessage(errorText(error, 'Could not delete category.'), 'error');
    } finally {
      setCategoryToDelete(null);
    }
  };

  const handleArchiveCategory = async (id: string) => {
    const projectId = requireProjectId();
    if (!projectId) return;
    try {
      await archiveLeaveCategoryFn({ id, projectId });
      if (currentCategory?.id === id) setCurrentCategory(null);
      showToastMessage('Category archived.', 'success');
      refetchCategories();
      setMobileSidebarOpen(false);
    } catch (error) {
      showToastMessage(errorText(error, 'Could not archive category.'), 'error');
    }
  };

  const handleUnarchiveCategory = async (id: string) => {
    const projectId = requireProjectId();
    if (!projectId) return;
    try {
      await unarchiveLeaveCategoryFn({ id, projectId });
      showToastMessage('Category unarchived.', 'success');
      refetchCategories();
      setMobileSidebarOpen(false);
    } catch (error) {
      showToastMessage(errorText(error, 'Could not unarchive category.'), 'error');
    }
  };

  const handleAddGovernmentHoliday = async (input: {
    startDate: string;
    endDate: string | null;
    name: string;
    description?: string;
    scope: LeaveScope;
  }) => {
    const projectId = requireProjectId();
    if (!projectId) return;
    try {
      const saved = await createGovernmentHolidaysFn({
        projectId,
        scope: input.scope,
        name: input.name,
        description: input.description,
        startDate: input.startDate,
        endDate: input.endDate,
      });
      showToastMessage(`Saved ${saved.length} holiday day${saved.length === 1 ? '' : 's'}.`, 'success');
      refetchHolidays();
      refetchLeaveDays();
      setMobileSidebarOpen(false);
    } catch (error) {
      showToastMessage(errorText(error, 'Could not add holiday.'), 'error');
    }
  };

  const handleDeleteGovernmentHoliday = async (id: string) => {
    const holiday = governmentHolidays.find((item) => item.id === id);
    try {
      await deleteGovernmentHolidayFn({ id });
      showToastMessage(holiday?.projectId == null ? 'Holiday removed from all projects.' : 'Holiday deleted.', 'success');
      refetchHolidays();
    } catch (error) {
      showToastMessage(errorText(error, 'Could not delete holiday.'), 'error');
    }
  };

  const handleCreateProject = async (name: string, color: string) => {
    try {
      const created = await createProjectFn({ name, color });
      writeStoredProjectId(created.id);
      setActiveProjectId(created.id);
      setCurrentCategory(null);
      showToastMessage('Project created.', 'success');
      refetchProjects();
      setMobileSidebarOpen(false);
    } catch (error) {
      showToastMessage(errorText(error, 'Could not create project.'), 'error');
    }
  };

  const handleUpdateProject = async (id: string, name: string, color: string | null) => {
    try {
      await updateProjectFn({ id, name, color });
      showToastMessage('Project updated.', 'success');
      refetchProjects();
    } catch (error) {
      showToastMessage(errorText(error, 'Could not update project.'), 'error');
    }
  };

  const handleArchiveProject = async (id: string) => {
    try {
      await archiveProjectFn({ id });
      showToastMessage('Project archived.', 'success');
      refetchProjects();
    } catch (error) {
      showToastMessage(errorText(error, 'Could not archive project.'), 'error');
    }
  };

  const handleUnarchiveProject = async (id: string) => {
    try {
      await unarchiveProjectFn({ id });
      showToastMessage('Project restored.', 'success');
      refetchProjects();
    } catch (error) {
      showToastMessage(errorText(error, 'Could not restore project.'), 'error');
    }
  };

  const renderTools = () => (
    <>
      <ProjectManager
        projects={projects}
        activeProjectId={activeProjectId}
        onCreate={handleCreateProject}
        onUpdate={handleUpdateProject}
        onArchive={handleArchiveProject}
        onUnarchive={handleUnarchiveProject}
        onSelect={selectProject}
      />
      <LeaveCategoryManager
        categories={categories}
        leaveDates={leaveDates}
        governmentHolidays={governmentHolidays}
        onAddCategory={handleAddCategory}
        onEditCategory={handleEditCategory}
        onDeleteCategory={(id) => {
          setCategoryToDelete(id);
          setDeleteConfirmOpen(true);
        }}
        onArchiveCategory={handleArchiveCategory}
        onUnarchiveCategory={handleUnarchiveCategory}
        onAddGovernmentHoliday={handleAddGovernmentHoliday}
        onDeleteGovernmentHoliday={handleDeleteGovernmentHoliday}
      />
    </>
  );

  const waitingForProject = projectsLoading || (projects.length > 0 && !activeProjectId);
  const initialLoading =
    waitingForProject || (projectReady && (categoriesLoading || leaveDaysLoading || holidaysLoading));

  return (
    <div className="min-h-screen bg-gray-50 p-3 md:p-4">
      {showToast && <Toast message={toastMessage} type={toastType} onClose={() => setShowToast(false)} />}

      <div className="mx-auto max-w-[90rem]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-gray-900">Leave Manager</h1>
          <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
            <SheetTrigger asChild>
              <button type="button" className="rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700 lg:hidden" aria-label="Open settings">
                <Cog6ToothIcon className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Projects, categories, holidays</SheetTitle>
              </SheetHeader>
              <div className="mt-4">{renderTools()}</div>
            </SheetContent>
          </Sheet>
        </div>

        {initialLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
          </div>
        ) : (
          <>
            <div className="sticky top-0 z-40 mb-3">
              <LeaveCategorySelector
                categories={categories}
                currentCategory={currentCategory}
                onCategoryChange={setCurrentCategory}
                leaveDates={leaveDates}
                rangeMode={rangeMode}
                onRangeModeChange={setRangeMode}
                markMode={markMode}
                onMarkModeChange={setMarkMode}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
              <div className="lg:col-span-3">
                <Calendar
                  projects={projects}
                  activeProjectId={activeProjectId}
                  onSelectProject={selectProject}
                  currentCategory={currentCategory}
                  leaveDates={leaveDates}
                  governmentHolidays={governmentHolidays}
                  categories={categories}
                  rangeMode={rangeMode}
                  markMode={markMode}
                  includeWeekends={includeWeekends}
                  onIncludeWeekendsChange={setIncludeWeekends}
                  onDateToggle={handleDateToggle}
                  onDateRangeToggle={handleDateRangeToggle}
                />
              </div>
              <div className="hidden lg:block">{renderTools()}</div>
            </div>
          </>
        )}
      </div>

      <ConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete leave category"
        description={
          categories.find((category) => category.id === categoryToDelete)?.projectId == null
            ? 'This category is shared by every project. Deleting it removes it and its leave dates from all of them.'
            : 'Delete this category and its leave dates in the current project?'
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmDeleteCategory}
      />
    </div>
  );
};
