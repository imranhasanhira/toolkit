import { HttpError, prisma } from "wasp/server";
import { requireAppAccess } from "../server/appPermissions";
import { APP_KEYS } from "../shared/appKeys";

// --- Helpers ---
async function checkAuth(context: any) {
  if (!context.user) throw new HttpError(401, "Unauthorized");
  await requireAppAccess(context.user.id, APP_KEYS.CARELY, context.user.isAdmin);
  return context.user.id;
}

function parseLocalDateKey(dateKey: string): Date {
  // Expect "YYYY-MM-DD" and create a local-midnight Date.
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) throw new HttpError(400, 'Invalid date');
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

// --- Parents ---
export const getCarelyParents = async (args: void, context: any) => {
  const userId = await checkAuth(context);
  return context.entities.CarelyParent.findMany({
    where: {
      OR: [
        { createdByUserId: userId },
        { collaborators: { some: { userId } } }
      ]
    },
    include: { collaborators: true },
    orderBy: { createdAt: "desc" }
  });
};

export const getCarelyParentById = async (args: { id: string }, context: any) => {
  const userId = await checkAuth(context);
  const parent = await context.entities.CarelyParent.findUnique({
    where: { id: args.id },
    include: {
      collaborators: {
        include: { user: { select: { email: true, username: true } } }
      }
    }
  });
  if (!parent) throw new HttpError(404, "Not found");
  
  const isOwner = parent.createdByUserId === userId;
  const isCollab = parent.collaborators.some((c: any) => c.userId === userId);
  if (!isOwner && !isCollab) throw new HttpError(403, "Access denied");

  return parent;
};

export const createCarelyParent = async (args: { name: string; dateOfBirth?: Date; notes?: string; avatarUrl?: string }, context: any) => {
  const userId = await checkAuth(context);
  return context.entities.CarelyParent.create({
    data: {
      ...args,
      createdByUserId: userId
    }
  });
};

export const updateCarelyParent = async (args: { id: string; name?: string; dateOfBirth?: Date; notes?: string; avatarUrl?: string; temperatureUnit?: 'C' | 'F' }, context: any) => {
  const userId = await checkAuth(context);
  const parent = await context.entities.CarelyParent.findUnique({ where: { id: args.id } });
  if (!parent || parent.createdByUserId !== userId) throw new HttpError(403, "Only owner can edit");

  return context.entities.CarelyParent.update({
    where: { id: args.id },
    data: {
      name: args.name,
      dateOfBirth: args.dateOfBirth,
      notes: args.notes,
      avatarUrl: args.avatarUrl,
      temperatureUnit: args.temperatureUnit,
    }
  });
};

export const deleteCarelyParent = async (args: { id: string }, context: any) => {
  const userId = await checkAuth(context);
  const parent = await context.entities.CarelyParent.findUnique({ where: { id: args.id } });
  if (!parent || parent.createdByUserId !== userId) throw new HttpError(403, "Only owner can delete");
  return context.entities.CarelyParent.delete({ where: { id: args.id } });
};

// --- Collaborators ---
export const addCarelyCollaborator = async (args: { parentId: string; email: string }, context: any) => {
  const userId = await checkAuth(context);
  const parent = await context.entities.CarelyParent.findUnique({ where: { id: args.parentId } });
  if (!parent || parent.createdByUserId !== userId) throw new HttpError(403, "Only owner can manage collaborators");

  const invitee = await context.entities.User.findUnique({ where: { email: args.email } });
  if (!invitee) throw new HttpError(400, "No user found with this email");

  return context.entities.CarelyCollaborator.create({
    data: {
      parentId: args.parentId,
      userId: invitee.id,
    }
  });
};

export const updateCarelyCollaboratorPermissions = async (args: { id: string; canViewPrescription: boolean; canEditPrescription: boolean; canAddVitals: boolean; canViewVitals: boolean }, context: any) => {
  const userId = await checkAuth(context);
  const collab = await context.entities.CarelyCollaborator.findUnique({ where: { id: args.id }, include: { parent: true } });
  if (!collab || collab.parent.createdByUserId !== userId) throw new HttpError(403, "Only owner can manage collaborators");

  return context.entities.CarelyCollaborator.update({
    where: { id: args.id },
    data: {
      canViewPrescription: args.canViewPrescription,
      canEditPrescription: args.canEditPrescription,
      canAddVitals: args.canAddVitals,
      canViewVitals: args.canViewVitals,
    }
  });
};

export const removeCarelyCollaborator = async (args: { id: string }, context: any) => {
  const userId = await checkAuth(context);
  const collab = await context.entities.CarelyCollaborator.findUnique({ where: { id: args.id }, include: { parent: true } });
  if (!collab || collab.parent.createdByUserId !== userId) throw new HttpError(403, "Only owner can manage collaborators");
  return context.entities.CarelyCollaborator.delete({ where: { id: args.id } });
};

// --- Vitals ---
export const getCarelyVitalLogs = async (args: { parentId: string; type?: string }, context: any) => {
  const userId = await checkAuth(context);
  const parent = await getCarelyParentById({ id: args.parentId }, context); // re-use access check
  const collab = parent.collaborators.find((c: any) => c.userId === userId);
  if (parent.createdByUserId !== userId && (!collab || !collab.canViewVitals)) {
    throw new HttpError(403, "View logs permission required");
  }

  const where: any = { parentId: args.parentId };
  if (args.type) where.type = args.type;

  return context.entities.CarelyVitalLog.findMany({
    where,
    orderBy: { loggedAt: "desc" },
    include: { loggedByUser: { select: { username: true, email: true } } }
  });
};

type CarelyVitalCategoryKind = "blood_pressure" | "numeric";

const DEFAULT_CARELY_VITAL_CATEGORIES: Array<{
  key: string;
  displayName: string;
  kind: CarelyVitalCategoryKind;
  unit?: string;
  sortOrder: number;
}> = [
  { key: "BLOOD_PRESSURE", displayName: "Blood Pressure", kind: "blood_pressure", unit: "mmHg", sortOrder: 10 },
  { key: "HEART_RATE", displayName: "Heart Rate", kind: "numeric", unit: "bpm", sortOrder: 20 },
  { key: "WEIGHT", displayName: "Weight", kind: "numeric", unit: "kg", sortOrder: 30 },
  { key: "GLUCOSE", displayName: "Glucose", kind: "numeric", unit: "mg/dL", sortOrder: 40 },
  // Temperature uses per-parent unit in the UI, but we keep a stable key.
  { key: "TEMPERATURE", displayName: "Temperature", kind: "numeric", unit: undefined, sortOrder: 50 },
  { key: "SPO2", displayName: "SpO₂", kind: "numeric", unit: "%", sortOrder: 60 },
];

async function ensureDefaultCarelyVitalCategories(context: any) {
  const count = await context.entities.CarelyVitalCategory.count();
  if (count > 0) return;
  await context.entities.CarelyVitalCategory.createMany({
    data: DEFAULT_CARELY_VITAL_CATEGORIES.map((c) => ({
      key: c.key,
      displayName: c.displayName,
      kind: c.kind,
      unit: c.unit,
      sortOrder: c.sortOrder,
      isActive: true,
    })),
  });
}

export const getCarelyVitalCategories = async (args: void, context: any) => {
  await checkAuth(context);
  // If DB isn't migrated yet, this will throw; callers can still use hardcoded defaults.
  try {
    await ensureDefaultCarelyVitalCategories(context);
    return await context.entities.CarelyVitalCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
    });
  } catch (e) {
    return DEFAULT_CARELY_VITAL_CATEGORIES.map((c) => ({
      id: `__default__${c.key}`,
      key: c.key,
      displayName: c.displayName,
      kind: c.kind,
      unit: c.unit ?? null,
      sortOrder: c.sortOrder,
      isActive: true,
    }));
  }
};

export const getCarelyAppSettings = async (args: void, context: any) => {
  await checkAuth(context);
  try {
    const existing = await context.entities.CarelyAppSettings.findUnique({ where: { id: 1 } });
    if (existing) return existing;
    return await context.entities.CarelyAppSettings.create({ data: { id: 1, temperatureUnit: "F" } });
  } catch (e) {
    // Fallback if migration not applied yet.
    return { id: 1, temperatureUnit: "F" };
  }
};

export const updateCarelyAppSettings = async (
  args: { temperatureUnit: "C" | "F" },
  context: any
) => {
  await checkAuth(context);
  if (!context.user?.isAdmin) throw new HttpError(403, "Only admins can update Carely settings");
  const unit = args.temperatureUnit === "C" ? "C" : "F";
  return context.entities.CarelyAppSettings.upsert({
    where: { id: 1 },
    create: { id: 1, temperatureUnit: unit },
    update: { temperatureUnit: unit },
  });
};

export const upsertCarelyVitalCategory = async (
  args: {
    id?: string;
    key: string;
    displayName: string;
    kind: CarelyVitalCategoryKind;
    unit?: string | null;
    isActive: boolean;
  },
  context: any
) => {
  await checkAuth(context);
  if (!context.user?.isAdmin) throw new HttpError(403, "Only admins can manage vital categories");

  const key = args.key.trim().toUpperCase();
  if (!/^[A-Z0-9_]+$/.test(key)) throw new HttpError(400, "Key must be A-Z, 0-9, and underscore only");
  const displayName = args.displayName.trim();
  if (!displayName) throw new HttpError(400, "Display name is required");

  const unit =
    args.kind === "numeric" ? (args.unit ?? "").trim() || null : (args.unit ?? "mmHg").trim() || "mmHg";

  if (args.id) {
    const existing = await context.entities.CarelyVitalCategory.findUnique({
      where: { id: args.id },
      select: { key: true },
    });
    if (!existing) throw new HttpError(404, "Category not found");

    // If the key is being renamed, we MUST also migrate every historical
    // CarelyVitalLog.type that points at the old key in the same transaction.
    // CarelyVitalLog.type is a plain String (no FK) that soft-references
    // CarelyVitalCategory.key, so a naive category-only rename would orphan
    // every historical log row for this vital.
    if (existing.key !== key) {
      // Guard: if some other category already owns the target key, fail fast
      // before touching any row. The schema has @unique on key so the update
      // itself would also fail, but catching it early gives a clean error.
      const clash = await context.entities.CarelyVitalCategory.findUnique({
        where: { key },
        select: { id: true },
      });
      if (clash && clash.id !== args.id) {
        throw new HttpError(409, `Another category already uses key "${key}"`);
      }

      const [updatedCategory] = await prisma.$transaction([
        context.entities.CarelyVitalCategory.update({
          where: { id: args.id },
          data: { key, displayName, kind: args.kind, unit, isActive: args.isActive },
        }),
        context.entities.CarelyVitalLog.updateMany({
          where: { type: existing.key },
          data: { type: key },
        }),
      ]);
      return updatedCategory;
    }

    return context.entities.CarelyVitalCategory.update({
      where: { id: args.id },
      data: {
        key,
        displayName,
        kind: args.kind,
        unit,
        isActive: args.isActive,
      },
    });
  }

  const maxOrder = await context.entities.CarelyVitalCategory.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (maxOrder?._max?.sortOrder ?? 0) + 10;

  return context.entities.CarelyVitalCategory.create({
    data: {
      key,
      displayName,
      kind: args.kind,
      unit,
      isActive: args.isActive,
      sortOrder,
    },
  });
};

export const deleteCarelyVitalCategory = async (args: { id: string }, context: any) => {
  await checkAuth(context);
  if (!context.user?.isAdmin) throw new HttpError(403, "Only admins can manage vital categories");
  return context.entities.CarelyVitalCategory.delete({ where: { id: args.id } });
};

export const reorderCarelyVitalCategories = async (args: { orderedIds: string[] }, context: any) => {
  await checkAuth(context);
  if (!context.user?.isAdmin) throw new HttpError(403, "Only admins can manage vital categories");
  const ids = args.orderedIds.filter((id) => !id.startsWith("__default__"));
  // We intentionally avoid using $transaction here because the shape of `context.entities`
  // varies across Wasp versions / compilation targets. Sequential updates are fine for
  // the small number of categories.
  for (let idx = 0; idx < ids.length; idx++) {
    const id = ids[idx];
    await context.entities.CarelyVitalCategory.update({
      where: { id },
      data: { sortOrder: (idx + 1) * 10 },
    });
  }
  return true;
};

export const addCarelyVitalLog = async (args: { parentId: string; type: string; value: any; notes?: string; loggedAt?: Date }, context: any) => {
  const userId = await checkAuth(context);
  const parent = await getCarelyParentById({ id: args.parentId }, context);
  const collab = parent.collaborators.find((c: any) => c.userId === userId);
  if (parent.createdByUserId !== userId && (!collab || !collab.canAddVitals)) {
    throw new HttpError(403, "Add logs permission required");
  }

  return context.entities.CarelyVitalLog.create({
    data: {
      parentId: args.parentId,
      loggedByUserId: userId,
      type: args.type,
      value: args.value,
      notes: args.notes,
      loggedAt: args.loggedAt || new Date()
    }
  });
};

export const updateCarelyVitalLog = async (args: { id: string; type?: string; value?: any; notes?: string; loggedAt?: Date }, context: any) => {
  const userId = await checkAuth(context);
  const log = await context.entities.CarelyVitalLog.findUnique({ where: { id: args.id }, include: { parent: { include: { collaborators: true } } } });
  if (!log) throw new HttpError(404, "Log not found");
  
  const parent = log.parent;
  const collab = parent.collaborators.find((c: any) => c.userId === userId);
  if (parent.createdByUserId !== userId && (!collab || !collab.canAddVitals)) {
    throw new HttpError(403, "Edit logs permission required");
  }

  return context.entities.CarelyVitalLog.update({
    where: { id: args.id },
    data: {
      type: args.type !== undefined ? args.type : undefined,
      value: args.value !== undefined ? args.value : undefined,
      notes: args.notes !== undefined ? args.notes : undefined,
      loggedAt: args.loggedAt !== undefined ? args.loggedAt : undefined
    }
  });
};

export const deleteCarelyVitalLog = async (args: { id: string }, context: any) => {
  const userId = await checkAuth(context);
  const log = await context.entities.CarelyVitalLog.findUnique({ where: { id: args.id }, include: { parent: true } });
  if (!log) throw new HttpError(404, "Log not found");
  if (log.parent.createdByUserId !== userId && log.loggedByUserId !== userId) {
    throw new HttpError(403, "Access denied");
  }
  return context.entities.CarelyVitalLog.delete({ where: { id: args.id } });
};

// --- Prescriptions ---
export const getCarelyPrescriptions = async (args: { parentId: string }, context: any) => {
  const userId = await checkAuth(context);
  const parent = await getCarelyParentById({ id: args.parentId }, context);
  const collab = parent.collaborators.find((c: any) => c.userId === userId);
  if (parent.createdByUserId !== userId && (!collab || !collab.canViewPrescription)) {
    throw new HttpError(403, "View prescription permission required");
  }

  return context.entities.CarelyPrescription.findMany({
    where: { parentId: args.parentId, isActive: true },
    orderBy: { createdAt: "desc" }
  });
};

export const getCarelyPrescriptionHistory = async (args: { parentId: string }, context: any) => {
  const userId = await checkAuth(context);
  const parent = await getCarelyParentById({ id: args.parentId }, context);
  const collab = parent.collaborators.find((c: any) => c.userId === userId);
  if (parent.createdByUserId !== userId && (!collab || !collab.canViewPrescription)) {
    throw new HttpError(403, "View prescription permission required");
  }
  return context.entities.CarelyPrescription.findMany({
    where: { parentId: args.parentId },
    orderBy: { createdAt: "desc" }
  });
};

export const createCarelyPrescription = async (args: { parentId: string; medicineName: string; doseSchedule: any; doseNote?: string; startDate: Date; endDate?: Date }, context: any) => {
  const userId = await checkAuth(context);
  const parent = await getCarelyParentById({ id: args.parentId }, context);
  const collab = parent.collaborators.find((c: any) => c.userId === userId);
  if (parent.createdByUserId !== userId && (!collab || !collab.canEditPrescription)) {
    throw new HttpError(403, "Edit prescription permission required");
  }

  return context.entities.CarelyPrescription.create({
    data: {
      parentId: args.parentId,
      createdByUserId: userId,
      medicineName: args.medicineName,
      doseSchedule: args.doseSchedule,
      doseNote: args.doseNote,
      startDate: args.startDate,
      endDate: args.endDate,
      isActive: true
    }
  });
};

export const updateCarelyPrescription = async (args: { id: string; medicineName?: string; doseSchedule?: any; doseNote?: string; startDate?: Date; endDate?: Date; isActive?: boolean }, context: any) => {
  const userId = await checkAuth(context);
  const rx = await context.entities.CarelyPrescription.findUnique({ where: { id: args.id }, include: { parent: { include: { collaborators: true } } } });
  if (!rx) throw new HttpError(404, "Not found");
  
  const parent = rx.parent;
  const collab = parent.collaborators.find((c: any) => c.userId === userId);
  if (parent.createdByUserId !== userId && (!collab || !collab.canEditPrescription)) {
    throw new HttpError(403, "Edit prescription permission required");
  }

  return context.entities.CarelyPrescription.update({
    where: { id: args.id },
    data: {
      medicineName: args.medicineName,
      doseSchedule: args.doseSchedule,
      doseNote: args.doseNote,
      startDate: args.startDate,
      endDate: args.endDate,
      isActive: args.isActive,
    }
  });
};

export const deactivateCarelyPrescription = async (args: { id: string }, context: any) => {
  return updateCarelyPrescription({ id: args.id, isActive: false }, context);
};

// --- Intake Logs ---
export const getCarelyMedicineIntakeLogs = async (args: { parentId: string; date?: string }, context: any) => {
  const userId = await checkAuth(context);
  const parent = await getCarelyParentById({ id: args.parentId }, context);
  const collab = parent.collaborators.find((c: any) => c.userId === userId);
  if (parent.createdByUserId !== userId && (!collab || !collab.canViewPrescription)) {
    throw new HttpError(403, "View prescription permission required");
  }

  // Default to today (local date).
  const today = new Date();
  const fallback = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const targetDateStr = args.date || fallback;
  const targetDate = parseLocalDateKey(targetDateStr);

  return context.entities.CarelyMedicineIntakeLog.findMany({
    where: {
      prescription: { parentId: args.parentId },
      intakeDate: targetDate
    }
  });
};

export const getCarelyMedicineLogsByRange = async (args: { parentId: string; startDate: Date; endDate: Date }, context: any) => {
  const userId = await checkAuth(context);
  const parent = await getCarelyParentById({ id: args.parentId }, context);
  const collab = parent.collaborators.find((c: any) => c.userId === userId);
  if (parent.createdByUserId !== userId && (!collab || !collab.canViewPrescription)) {
    throw new HttpError(403, "View prescription permission required");
  }

  return context.entities.CarelyMedicineIntakeLog.findMany({
    where: {
      prescription: { parentId: args.parentId },
      intakeDate: {
        gte: args.startDate,
        lte: args.endDate
      }
    }
  });
};

export const logCarelyMedicineIntake = async (args: { prescriptionId: string; slot: string; intakeDateStr: string }, context: any) => {
  const userId = await checkAuth(context);
  const rx = await context.entities.CarelyPrescription.findUnique({ where: { id: args.prescriptionId }, include: { parent: { include: { collaborators: true } } } });
  if (!rx) throw new HttpError(404, "Not found");

  const parent = rx.parent;
  const collab = parent.collaborators.find((c: any) => c.userId === userId);
  if (parent.createdByUserId !== userId && (!collab || !collab.canEditPrescription)) {
    // Actually, maybe editing prescription and logging are separate matters.
    // For medicine tracking, let's say "canAddVitals" or "canEditPrescription" is needed?
    // User requested: "canAddVitals" / "canViewVitals" / "canViewPrescription" / "canEditPrescription"
    // Usually checking off medicine would fall under view/edit prescriptions, let's say Edit Prescription.
    if (!collab?.canEditPrescription && !collab?.canAddVitals) {
       throw new HttpError(403, "Permission required to log medicine");
    }
  }

  const intakeDate = parseLocalDateKey(args.intakeDateStr);

  // Use unique compound block to create or nothing if already exists
  return context.entities.CarelyMedicineIntakeLog.upsert({
    where: {
      prescriptionId_slot_intakeDate: {
        prescriptionId: args.prescriptionId,
        slot: args.slot,
        intakeDate: intakeDate
      }
    },
    update: {
      loggedByUserId: userId,
      takenAt: new Date()
    },
    create: {
      prescriptionId: args.prescriptionId,
      loggedByUserId: userId,
      slot: args.slot,
      intakeDate: intakeDate,
      takenAt: new Date()
    }
  });
};

export const unlogCarelyMedicineIntake = async (args: { prescriptionId: string; slot: string; intakeDateStr: string }, context: any) => {
  const userId = await checkAuth(context);
  const rx = await context.entities.CarelyPrescription.findUnique({ where: { id: args.prescriptionId }, include: { parent: { include: { collaborators: true } } } });
  if (!rx) throw new HttpError(404, "Not found");

  const parent = rx.parent;
  const collab = parent.collaborators.find((c: any) => c.userId === userId);
  if (parent.createdByUserId !== userId && !collab?.canEditPrescription && !collab?.canAddVitals) {
     throw new HttpError(403, "Permission required");
  }

  const intakeDate = parseLocalDateKey(args.intakeDateStr);

  return context.entities.CarelyMedicineIntakeLog.deleteMany({
    where: {
       prescriptionId: args.prescriptionId,
       slot: args.slot,
       intakeDate: intakeDate
    }
  });
};

export const clearCarelyMockData = async (args: { parentId: string }, context: any) => {
  const userId = await checkAuth(context);
  
  // Verify access
  const parent = await context.entities.CarelyParent.findUnique({ where: { id: args.parentId }, include: { collaborators: true } });
  if (!parent) throw new HttpError(404);
  const isOwner = parent.createdByUserId === userId;
  if (!isOwner && !parent.collaborators.some((c: any) => c.userId === userId)) throw new HttpError(403);

  await context.entities.CarelyVitalLog.deleteMany({ where: { parentId: args.parentId, notes: 'MOCK_DATA' } });
  
  const mockRxs = await context.entities.CarelyPrescription.findMany({ where: { parentId: args.parentId, doseNote: 'MOCK_DATA' } });
  const mockRxIds = mockRxs.map((r: any) => r.id);
  if (mockRxIds.length > 0) {
    await context.entities.CarelyMedicineIntakeLog.deleteMany({ where: { prescriptionId: { in: mockRxIds } } });
    await context.entities.CarelyPrescription.deleteMany({ where: { id: { in: mockRxIds } } });
  }
};

export const seedCarelyMockData = async (args: { parentId: string }, context: any) => {
  const userId = await checkAuth(context);
  const parent = await context.entities.CarelyParent.findUnique({ where: { id: args.parentId }, include: { collaborators: true } });
  if (!parent) throw new HttpError(404);
  const isOwner = parent.createdByUserId === userId;
  if (!isOwner && !parent.collaborators.some((c: any) => c.userId === userId)) throw new HttpError(403);

  const now = new Date();
  const vitalLogs: any[] = [];
  
  for (let i = 60; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    
    vitalLogs.push({
      parentId: args.parentId,
      loggedByUserId: userId,
      type: 'BLOOD_PRESSURE',
      value: { systolic: 110 + Math.floor(Math.random()*20), diastolic: 70 + Math.floor(Math.random()*15), unit: 'mmHg' },
      notes: 'MOCK_DATA',
      loggedAt: new Date(d.getTime() + Math.random() * 3600000)
    });
    
    vitalLogs.push({
      parentId: args.parentId,
      loggedByUserId: userId,
      type: 'HEART_RATE',
      value: { value: 60 + Math.floor(Math.random()*40), unit: 'bpm' },
      notes: 'MOCK_DATA',
      loggedAt: new Date(d.getTime() + Math.random() * 3600000)
    });

    if (Math.random() > 0.35) {
      vitalLogs.push({
        parentId: args.parentId,
        loggedByUserId: userId,
        type: 'WEIGHT',
        value: { value: 16 + Math.round(Math.random() * 12 * 10) / 10, unit: 'kg' },
        notes: 'MOCK_DATA',
        loggedAt: new Date(d.getTime() + Math.random() * 3600000)
      });
    }

    if (Math.random() > 0.5) {
       vitalLogs.push({
         parentId: args.parentId,
         loggedByUserId: userId,
         type: 'GLUCOSE',
         value: { value: 90 + Math.floor(Math.random()*30), unit: 'mg/dL' },
         notes: 'MOCK_DATA',
         loggedAt: new Date(d.getTime() + Math.random() * 3600000)
       });
    }
  }
  
  await context.entities.CarelyVitalLog.createMany({ data: vitalLogs });

  const rx = await context.entities.CarelyPrescription.create({
    data: {
      parentId: args.parentId,
      createdByUserId: userId,
      medicineName: 'Mockitol 50mg',
      doseSchedule: { type: 'standard', morning: 1, afternoon: 0, evening: 1, night: 0 },
      doseNote: 'MOCK_DATA',
      startDate: new Date(now.getTime() - 60*24*3600000),
      isActive: true
    }
  });

  const intakeLogs: any[] = [];
  for (let i = 60; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0,0,0,0);
    if (Math.random() > 0.15) intakeLogs.push({ prescriptionId: rx.id, loggedByUserId: userId, slot: 'morning', intakeDate: d });
    if (Math.random() > 0.3) intakeLogs.push({ prescriptionId: rx.id, loggedByUserId: userId, slot: 'evening', intakeDate: d });
  }

  await context.entities.CarelyMedicineIntakeLog.createMany({ data: intakeLogs });
};
