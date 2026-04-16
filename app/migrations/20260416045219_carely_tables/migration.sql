-- CreateTable
CREATE TABLE "CarelyParent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "notes" TEXT,
    "avatarUrl" TEXT,
    "temperatureUnit" TEXT NOT NULL DEFAULT 'F',

    CONSTRAINT "CarelyParent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarelyCollaborator" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canViewPrescription" BOOLEAN NOT NULL DEFAULT true,
    "canEditPrescription" BOOLEAN NOT NULL DEFAULT false,
    "canAddVitals" BOOLEAN NOT NULL DEFAULT true,
    "canViewVitals" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CarelyCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarelyVitalLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parentId" TEXT NOT NULL,
    "loggedByUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "CarelyVitalLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarelyPrescription" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parentId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "medicineName" TEXT NOT NULL,
    "doseSchedule" JSONB NOT NULL,
    "doseNote" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CarelyPrescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarelyMedicineIntakeLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prescriptionId" TEXT NOT NULL,
    "loggedByUserId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "intakeDate" TIMESTAMP(3) NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarelyMedicineIntakeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CarelyCollaborator_parentId_userId_key" ON "CarelyCollaborator"("parentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CarelyMedicineIntakeLog_prescriptionId_slot_intakeDate_key" ON "CarelyMedicineIntakeLog"("prescriptionId", "slot", "intakeDate");

-- AddForeignKey
ALTER TABLE "CarelyParent" ADD CONSTRAINT "CarelyParent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarelyCollaborator" ADD CONSTRAINT "CarelyCollaborator_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CarelyParent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarelyCollaborator" ADD CONSTRAINT "CarelyCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarelyVitalLog" ADD CONSTRAINT "CarelyVitalLog_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CarelyParent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarelyVitalLog" ADD CONSTRAINT "CarelyVitalLog_loggedByUserId_fkey" FOREIGN KEY ("loggedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarelyPrescription" ADD CONSTRAINT "CarelyPrescription_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CarelyParent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarelyPrescription" ADD CONSTRAINT "CarelyPrescription_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarelyMedicineIntakeLog" ADD CONSTRAINT "CarelyMedicineIntakeLog_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "CarelyPrescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarelyMedicineIntakeLog" ADD CONSTRAINT "CarelyMedicineIntakeLog_loggedByUserId_fkey" FOREIGN KEY ("loggedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
