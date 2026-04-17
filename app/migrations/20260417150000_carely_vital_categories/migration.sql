-- CreateTable
CREATE TABLE "CarelyVitalCategory" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "key" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "unit" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "CarelyVitalCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CarelyVitalCategory_key_key" ON "CarelyVitalCategory"("key");

