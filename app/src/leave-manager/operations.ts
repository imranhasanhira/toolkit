import { HttpError } from 'wasp/server';
import { requireAppAccess } from '../server/appPermissions';
import { APP_KEYS } from '../shared/appKeys';
import type {
  GetLeaveProjects,
  CreateLeaveProject,
  UpdateLeaveProject,
  ArchiveLeaveProject,
  UnarchiveLeaveProject,
  GetLeaveCategories,
  GetLeaveDays,
  GetGovernmentHolidays,
  CreateLeaveCategory,
  UpdateLeaveCategory,
  DeleteLeaveCategory,
  ArchiveLeaveCategory,
  UnarchiveLeaveCategory,
  UpsertLeaveDays,
  DeleteLeaveDays,
  CreateGovernmentHolidays,
  DeleteGovernmentHoliday,
} from 'wasp/server/operations';
import type { LmGovernmentHoliday, LmLeaveCategory, LmLeaveDay, LmLeaveProject } from 'wasp/entities';
import { dateFromDateString, expandDateRange, isDateString, isDateWithinRange, toDateString } from './dates';
import { DEFAULT_GOVERNMENT_HOLIDAYS, DEFAULT_LEAVE_CATEGORIES, DEFAULT_PROJECT_NAME } from './defaults';
import { GLOBAL_SCOPE_ID, type LeaveScope, scopeIdFor } from './scope';

type OpContext = {
  user?: { id: string; isAdmin?: boolean } | null;
  entities: any;
};

async function assertUser(context: OpContext) {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized');
  }
  await requireAppAccess(context.user.id, APP_KEYS.LEAVE_MANAGER, context.user.isAdmin);
  return context.user;
}

function isUniqueConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002';
}

async function requireOwnedProject(context: OpContext, projectId: string, options?: { allowArchived?: boolean }) {
  const user = await assertUser(context);
  if (!projectId) {
    throw new HttpError(400, 'Project is required');
  }

  const project = await context.entities.LmLeaveProject.findFirst({
    where: { id: projectId, userId: user.id },
  });

  if (!project) {
    throw new HttpError(404, 'Project not found');
  }

  if (project.isArchived && !options?.allowArchived) {
    throw new HttpError(400, 'Project is archived');
  }

  return project as LmLeaveProject;
}

function assertValidDateString(value: string, label: string) {
  if (!isDateString(value)) {
    throw new HttpError(400, `${label} must be a valid YYYY-MM-DD date`);
  }
}

function categoryBounds(category: { startDate: Date | string; endDate: Date | string | null }) {
  const start = toDateString(category.startDate);
  const end = toDateString(category.endDate);
  if (!start) {
    throw new HttpError(500, 'Category is missing a start date');
  }
  return { start, end };
}

function assertDateInCategory(
  dateString: string,
  category: { startDate: Date | string; endDate: Date | string | null }
) {
  const { start, end } = categoryBounds(category);
  if (!isDateWithinRange(dateString, start, end)) {
    throw new HttpError(
      400,
      `Date ${dateString} is outside the category date range (${start} to ${end ?? 'open-ended'})`
    );
  }
}

function visibleInProject(projectId: string) {
  return { OR: [{ projectId }, { projectId: null }] };
}

async function seedProjectDefaults(context: OpContext, project: LmLeaveProject): Promise<LmLeaveProject> {
  if (project.defaultsSeeded) return project;

  const year = new Date().getFullYear();
  const startDate = dateFromDateString(`${year}-01-01`);
  const endDate = dateFromDateString(`${year}-12-31`);

  for (const category of DEFAULT_LEAVE_CATEGORIES) {
    const existing = await context.entities.LmLeaveCategory.findFirst({
      where: { userId: project.userId, projectId: project.id, name: category.name },
    });
    if (existing) continue;

    try {
      await context.entities.LmLeaveCategory.create({
        data: {
          name: category.name,
          color: category.color,
          quota: category.quota,
          startDate,
          endDate,
          userId: project.userId,
          projectId: project.id,
          scopeId: project.id,
        },
      });
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
    }
  }

  return context.entities.LmLeaveProject.update({
    where: { id: project.id },
    data: { defaultsSeeded: true },
  });
}

async function seedGlobalHolidays(context: OpContext, userId: string): Promise<void> {
  const settings = await context.entities.LmSettings.findUnique({ where: { userId } });
  if (settings?.holidaysSeeded) return;

  for (const holiday of DEFAULT_GOVERNMENT_HOLIDAYS) {
    const existing = await context.entities.LmGovernmentHoliday.findFirst({
      where: { userId, projectId: null, dateString: holiday.date },
    });
    if (existing) continue;

    try {
      await context.entities.LmGovernmentHoliday.create({
        data: {
          date: dateFromDateString(holiday.date),
          dateString: holiday.date,
          name: holiday.name,
          userId,
          projectId: null,
          scopeId: GLOBAL_SCOPE_ID,
        },
      });
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
    }
  }

  if (settings) {
    await context.entities.LmSettings.update({
      where: { userId },
      data: { holidaysSeeded: true },
    });
    return;
  }

  try {
    await context.entities.LmSettings.create({
      data: { userId, holidaysSeeded: true },
    });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    await context.entities.LmSettings.update({
      where: { userId },
      data: { holidaysSeeded: true },
    });
  }
}

async function ensureDefaultProject(context: OpContext, userId: string): Promise<void> {
  const existingCount = await context.entities.LmLeaveProject.count({ where: { userId } });
  if (existingCount > 0) return;

  try {
    await context.entities.LmLeaveProject.create({
      data: {
        name: DEFAULT_PROJECT_NAME,
        color: '#2563EB',
        userId,
        defaultsSeeded: false,
      },
    });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
  }
}

export const getLeaveProjects: GetLeaveProjects<void, LmLeaveProject[]> = async (_args, context) => {
  const user = await assertUser(context);
  await ensureDefaultProject(context, user.id);
  await seedGlobalHolidays(context, user.id);

  const projects = await context.entities.LmLeaveProject.findMany({
    where: { userId: user.id },
    orderBy: [{ isArchived: 'asc' }, { createdAt: 'asc' }],
  });

  const ready: LmLeaveProject[] = [];
  for (const project of projects) {
    if (!project.defaultsSeeded) {
      ready.push(await seedProjectDefaults(context, project));
    } else {
      ready.push(project);
    }
  }
  return ready;
};

export const createLeaveProject: CreateLeaveProject<{ name: string; color?: string | null }, LmLeaveProject> = async (args, context) => {
  const user = await assertUser(context);
  const name = args.name?.trim();
  if (!name) {
    throw new HttpError(400, 'Project name is required');
  }

  const color = args.color?.trim() || '#2563EB';

  let project: LmLeaveProject;
  try {
    project = await context.entities.LmLeaveProject.create({
      data: {
        name,
        color,
        userId: user.id,
        defaultsSeeded: false,
      },
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new HttpError(400, 'Project name already exists');
    }
    throw error;
  }

  return seedProjectDefaults(context, project);
};

export const updateLeaveProject: UpdateLeaveProject<{ id: string; name?: string; color?: string | null }, LmLeaveProject> = async (
  args,
  context
) => {
  const project = await requireOwnedProject(context, args.id, { allowArchived: true });
  const data: { name?: string; color?: string | null } = {};

  if (args.name !== undefined) {
    const name = args.name.trim();
    if (!name) {
      throw new HttpError(400, 'Project name is required');
    }
    if (name !== project.name) {
      const conflict = await context.entities.LmLeaveProject.findFirst({
        where: { userId: project.userId, name, id: { not: project.id } },
      });
      if (conflict) {
        throw new HttpError(400, 'Project name already exists');
      }
    }
    data.name = name;
  }

  if (args.color !== undefined) {
    data.color = args.color?.trim() || null;
  }

  return context.entities.LmLeaveProject.update({
    where: { id: project.id },
    data,
  });
};

export const archiveLeaveProject: ArchiveLeaveProject<{ id: string }, LmLeaveProject> = async (args, context) => {
  const project = await requireOwnedProject(context, args.id, { allowArchived: true });
  if (project.isArchived) return project;

  const otherActive = await context.entities.LmLeaveProject.count({
    where: { userId: project.userId, isArchived: false, id: { not: project.id } },
  });
  if (otherActive === 0) {
    throw new HttpError(400, 'Keep at least one active project');
  }

  return context.entities.LmLeaveProject.update({
    where: { id: project.id },
    data: { isArchived: true },
  });
};

export const unarchiveLeaveProject: UnarchiveLeaveProject<{ id: string }, LmLeaveProject> = async (args, context) => {
  const project = await requireOwnedProject(context, args.id, { allowArchived: true });
  if (!project.isArchived) return project;

  return context.entities.LmLeaveProject.update({
    where: { id: project.id },
    data: { isArchived: false },
  });
};

export const getLeaveCategories: GetLeaveCategories<{ projectId: string }, LmLeaveCategory[]> = async (args, context) => {
  const project = await requireOwnedProject(context, args.projectId, { allowArchived: true });

  return context.entities.LmLeaveCategory.findMany({
    where: { userId: project.userId, ...visibleInProject(project.id) },
    orderBy: [{ name: 'asc' }],
  });
};

export const getLeaveDays: GetLeaveDays<{ projectId: string }, LmLeaveDay[]> = async (args, context) => {
  const project = await requireOwnedProject(context, args.projectId, { allowArchived: true });

  return context.entities.LmLeaveDay.findMany({
    where: { userId: project.userId, projectId: project.id },
    include: { category: true },
    orderBy: { date: 'asc' },
  });
};

export const getGovernmentHolidays: GetGovernmentHolidays<{ projectId: string }, LmGovernmentHoliday[]> = async (
  args,
  context
) => {
  const project = await requireOwnedProject(context, args.projectId, { allowArchived: true });
  await seedGlobalHolidays(context, project.userId);

  return context.entities.LmGovernmentHoliday.findMany({
    where: { userId: project.userId, ...visibleInProject(project.id) },
    orderBy: [{ date: 'desc' }, { projectId: 'desc' }],
  });
};

type CategoryInput = {
  projectId: string;
  name: string;
  color: string;
  startDate: string;
  endDate: string | null;
  quota: number;
};

function parseScope(scope: string | undefined): LeaveScope {
  if (scope === 'global' || scope === 'project') return scope;
  throw new HttpError(400, 'Scope must be project or global');
}

function parseCategoryInput(args: CategoryInput) {
  const name = args.name?.trim();
  const color = args.color?.trim();
  if (!name) throw new HttpError(400, 'Category name is required');
  if (!color) throw new HttpError(400, 'Category color is required');
  assertValidDateString(args.startDate, 'Start date');
  if (args.endDate) {
    assertValidDateString(args.endDate, 'End date');
    if (args.startDate >= args.endDate) {
      throw new HttpError(400, 'End date must be after start date');
    }
  }
  if (!Number.isInteger(args.quota) || args.quota <= 0) {
    throw new HttpError(400, 'Quota must be greater than 0');
  }

  return {
    name,
    color,
    startDate: dateFromDateString(args.startDate),
    endDate: args.endDate ? dateFromDateString(args.endDate) : null,
    quota: args.quota,
  };
}

export const createLeaveCategory: CreateLeaveCategory<CategoryInput & { scope: LeaveScope }, LmLeaveCategory> = async (
  args,
  context
) => {
  const project = await requireOwnedProject(context, args.projectId);
  const data = parseCategoryInput(args);
  const scope = parseScope(args.scope);
  const categoryProjectId = scope === 'global' ? null : project.id;

  const existingCategory = await context.entities.LmLeaveCategory.findFirst({
    where: { userId: project.userId, projectId: categoryProjectId, name: data.name },
  });
  if (existingCategory) {
    throw new HttpError(
      400,
      scope === 'global'
        ? 'A global category with this name already exists'
        : 'This project already has a category with this name'
    );
  }

  return context.entities.LmLeaveCategory.create({
    data: {
      ...data,
      userId: project.userId,
      projectId: categoryProjectId,
      scopeId: scopeIdFor(categoryProjectId),
    },
  });
};

export const updateLeaveCategory: UpdateLeaveCategory<CategoryInput & { id: string }, LmLeaveCategory> = async (
  args,
  context
) => {
  const project = await requireOwnedProject(context, args.projectId);
  const data = parseCategoryInput(args);

  const existingCategory = await context.entities.LmLeaveCategory.findFirst({
    where: {
      id: args.id,
      userId: project.userId,
      ...visibleInProject(project.id),
    },
  });
  if (!existingCategory) {
    throw new HttpError(404, 'Category not found');
  }

  if (data.name !== existingCategory.name) {
    const nameConflict = await context.entities.LmLeaveCategory.findFirst({
      where: {
        userId: project.userId,
        projectId: existingCategory.projectId,
        name: data.name,
        id: { not: args.id },
      },
    });
    if (nameConflict) {
      throw new HttpError(
        400,
        existingCategory.projectId
          ? 'This project already has a category with this name'
          : 'A global category with this name already exists'
      );
    }
  }

  const usedDays = await context.entities.LmLeaveDay.count({
    where: { userId: project.userId, projectId: project.id, categoryId: args.id },
  });
  if (data.quota < usedDays) {
    throw new HttpError(400, `Quota cannot be less than currently used days (${usedDays})`);
  }

  return context.entities.LmLeaveCategory.update({
    where: { id: args.id },
    data,
  });
};

export const deleteLeaveCategory: DeleteLeaveCategory<{ id: string; projectId: string }, void> = async (
  args,
  context
) => {
  const project = await requireOwnedProject(context, args.projectId);

  const existingCategory = await context.entities.LmLeaveCategory.findFirst({
    where: { id: args.id, userId: project.userId, ...visibleInProject(project.id) },
  });
  if (!existingCategory) {
    throw new HttpError(404, 'Category not found');
  }

  await context.entities.LmLeaveDay.deleteMany({
    where: { userId: project.userId, categoryId: args.id },
  });

  await context.entities.LmLeaveCategory.delete({
    where: { id: args.id },
  });
};

export const archiveLeaveCategory: ArchiveLeaveCategory<{ id: string; projectId: string }, LmLeaveCategory> = async (
  args,
  context
) => {
  const project = await requireOwnedProject(context, args.projectId);
  const category = await context.entities.LmLeaveCategory.findFirst({
    where: { id: args.id, userId: project.userId, ...visibleInProject(project.id) },
  });
  if (!category) {
    throw new HttpError(404, 'Category not found');
  }

  return context.entities.LmLeaveCategory.update({
    where: { id: args.id },
    data: { isArchived: true },
  });
};

export const unarchiveLeaveCategory: UnarchiveLeaveCategory<{ id: string; projectId: string }, LmLeaveCategory> = async (
  args,
  context
) => {
  const project = await requireOwnedProject(context, args.projectId);
  const category = await context.entities.LmLeaveCategory.findFirst({
    where: { id: args.id, userId: project.userId, ...visibleInProject(project.id) },
  });
  if (!category) {
    throw new HttpError(404, 'Category not found');
  }

  return context.entities.LmLeaveCategory.update({
    where: { id: args.id },
    data: { isArchived: false },
  });
};

export const upsertLeaveDays: UpsertLeaveDays<{ dates: string[]; categoryId: string; projectId: string }, LmLeaveDay[]> = async (
  args,
  context
) => {
  const project = await requireOwnedProject(context, args.projectId);

  const category = await context.entities.LmLeaveCategory.findFirst({
    where: { id: args.categoryId, userId: project.userId, ...visibleInProject(project.id) },
  });
  if (!category) {
    throw new HttpError(404, 'Category not found');
  }
  if (category.isArchived) {
    throw new HttpError(400, 'Cannot mark days on an archived category');
  }

  const dates = [...new Set(args.dates ?? [])];
  if (dates.length === 0) return [];

  for (const dateString of dates) {
    assertValidDateString(dateString, 'Date');
    assertDateInCategory(dateString, category);
  }

  const existing = await context.entities.LmLeaveDay.findMany({
    where: {
      userId: project.userId,
      projectId: project.id,
      categoryId: args.categoryId,
      dateString: { in: dates },
    },
  });
  const existingByDate = new Map(existing.map((day: LmLeaveDay) => [day.dateString, day]));
  const leaveDays: LmLeaveDay[] = [];

  for (const dateString of dates) {
    const existingLeaveDay = existingByDate.get(dateString);
    if (existingLeaveDay) {
      leaveDays.push(existingLeaveDay);
      continue;
    }

    const created = await context.entities.LmLeaveDay.create({
      data: {
        date: dateFromDateString(dateString),
        dateString,
        categoryId: args.categoryId,
        userId: project.userId,
        projectId: project.id,
      },
      include: { category: true },
    });
    leaveDays.push(created);
  }

  return leaveDays;
};

export const deleteLeaveDays: DeleteLeaveDays<
  { dates: string[]; projectId: string; categoryId?: string },
  void
> = async (args, context) => {
  const project = await requireOwnedProject(context, args.projectId);
  const dates = [...new Set(args.dates ?? [])];
  if (dates.length === 0) return;

  for (const dateString of dates) {
    assertValidDateString(dateString, 'Date');
  }

  await context.entities.LmLeaveDay.deleteMany({
    where: {
      userId: project.userId,
      projectId: project.id,
      dateString: { in: dates },
      ...(args.categoryId ? { categoryId: args.categoryId } : {}),
    },
  });
};

export const createGovernmentHolidays: CreateGovernmentHolidays<
  {
    projectId: string;
    scope: LeaveScope;
    name: string;
    description?: string | null;
    startDate: string;
    endDate?: string | null;
  },
  LmGovernmentHoliday[]
> = async (args, context) => {
  const project = await requireOwnedProject(context, args.projectId);
  const scope = parseScope(args.scope);
  const name = args.name?.trim();
  if (!name) {
    throw new HttpError(400, 'Holiday name is required');
  }

  assertValidDateString(args.startDate, 'Start date');
  const endDate = args.endDate?.trim() ? args.endDate : args.startDate;
  assertValidDateString(endDate, 'End date');

  const description = args.description?.trim() || null;
  const holidayProjectId = scope === 'global' ? null : project.id;
  const dateStrings = expandDateRange(args.startDate, endDate, {
    mode: 'all',
    skipWeekends: false,
  });

  const existing = await context.entities.LmGovernmentHoliday.findMany({
    where: { userId: project.userId, projectId: holidayProjectId, dateString: { in: dateStrings } },
  });
  const existingByDate = new Map(existing.map((holiday: LmGovernmentHoliday) => [holiday.dateString, holiday]));

  for (const holiday of existing) {
    await context.entities.LmGovernmentHoliday.update({
      where: { id: holiday.id },
      data: { name, description },
    });
  }

  const newDates = dateStrings.filter((dateString) => !existingByDate.has(dateString));
  if (newDates.length > 0) {
    await context.entities.LmGovernmentHoliday.createMany({
      data: newDates.map((dateString) => ({
        date: dateFromDateString(dateString),
        dateString,
        name,
        description,
        userId: project.userId,
        projectId: holidayProjectId,
        scopeId: scopeIdFor(holidayProjectId),
      })),
      skipDuplicates: true,
    });
  }

  await context.entities.LmLeaveDay.deleteMany({
    where: {
      userId: project.userId,
      ...(scope === 'project' ? { projectId: project.id } : {}),
      dateString: { in: dateStrings },
    },
  });

  return context.entities.LmGovernmentHoliday.findMany({
    where: { userId: project.userId, projectId: holidayProjectId, dateString: { in: dateStrings } },
    orderBy: { date: 'asc' },
  });
};

export const deleteGovernmentHoliday: DeleteGovernmentHoliday<{ id: string }, LmGovernmentHoliday> = async (
  args,
  context
) => {
  const user = await assertUser(context);
  const holiday = await context.entities.LmGovernmentHoliday.findFirst({
    where: { id: args.id, userId: user.id },
  });
  if (!holiday) {
    throw new HttpError(404, 'Holiday not found');
  }

  await context.entities.LmGovernmentHoliday.delete({
    where: { id: holiday.id },
  });

  return holiday;
};
