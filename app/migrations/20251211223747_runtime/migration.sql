-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "runtimeId" TEXT;

-- CreateTable
CREATE TABLE "Runtime" (
    "id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "defaultCode" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Runtime_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Runtime_language_key" ON "Runtime"("language");

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_runtimeId_fkey" FOREIGN KEY ("runtimeId") REFERENCES "Runtime"("id") ON DELETE SET NULL ON UPDATE CASCADE;
