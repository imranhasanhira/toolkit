-- CreateTable
CREATE TABLE "CarelyAppSettings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "temperatureUnit" TEXT NOT NULL DEFAULT 'F',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CarelyAppSettings_pkey" PRIMARY KEY ("id")
);

-- Ensure singleton row exists
INSERT INTO "CarelyAppSettings" ("id", "temperatureUnit", "updatedAt")
VALUES (1, 'F', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

