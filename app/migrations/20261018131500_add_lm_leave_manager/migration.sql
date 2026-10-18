-- CreateTable
CREATE TABLE "lm_leave_project" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "defaultsSeeded" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,

    CONSTRAINT "lm_leave_project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lm_leave_category" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "startDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATE,
    "quota" INTEGER NOT NULL DEFAULT 20,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "scopeId" TEXT NOT NULL,

    CONSTRAINT "lm_leave_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lm_leave_day" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" DATE NOT NULL,
    "dateString" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "lm_leave_day_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lm_government_holiday" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "date" DATE NOT NULL,
    "dateString" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "scopeId" TEXT NOT NULL,

    CONSTRAINT "lm_government_holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lm_settings" (
    "id" TEXT NOT NULL,
    "holidaysSeeded" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,

    CONSTRAINT "lm_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lm_leave_project_userId_name_key" ON "lm_leave_project"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "lm_leave_category_userId_scopeId_name_key" ON "lm_leave_category"("userId", "scopeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "lm_leave_day_userId_projectId_dateString_key" ON "lm_leave_day"("userId", "projectId", "dateString");

-- CreateIndex
CREATE UNIQUE INDEX "lm_government_holiday_userId_scopeId_dateString_key" ON "lm_government_holiday"("userId", "scopeId", "dateString");

-- CreateIndex
CREATE UNIQUE INDEX "lm_settings_userId_key" ON "lm_settings"("userId");

-- AddForeignKey
ALTER TABLE "lm_leave_project" ADD CONSTRAINT "lm_leave_project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lm_leave_category" ADD CONSTRAINT "lm_leave_category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lm_leave_category" ADD CONSTRAINT "lm_leave_category_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "lm_leave_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lm_leave_day" ADD CONSTRAINT "lm_leave_day_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lm_leave_day" ADD CONSTRAINT "lm_leave_day_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "lm_leave_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lm_leave_day" ADD CONSTRAINT "lm_leave_day_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "lm_leave_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lm_government_holiday" ADD CONSTRAINT "lm_government_holiday_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lm_government_holiday" ADD CONSTRAINT "lm_government_holiday_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "lm_leave_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lm_settings" ADD CONSTRAINT "lm_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
