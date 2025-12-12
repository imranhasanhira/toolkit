-- AlterTable
ALTER TABLE "Runtime" ADD COLUMN     "dockerImage" TEXT NOT NULL DEFAULT 'node:18-alpine',
ADD COLUMN     "fileName" TEXT NOT NULL DEFAULT 'solution.js',
ADD COLUMN     "runCommand" TEXT NOT NULL DEFAULT 'node solution.js';
