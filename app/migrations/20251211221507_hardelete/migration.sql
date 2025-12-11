/*
  Warnings:

  - You are about to drop the column `isDeleted` on the `TestCase` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "SubmissionTestCaseResult" DROP CONSTRAINT "SubmissionTestCaseResult_testCaseId_fkey";

-- AlterTable
ALTER TABLE "SubmissionTestCaseResult" ADD COLUMN     "expectedOutput" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "input" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "testCaseId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "TestCase" DROP COLUMN "isDeleted";

-- AddForeignKey
ALTER TABLE "SubmissionTestCaseResult" ADD CONSTRAINT "SubmissionTestCaseResult_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
