-- CreateEnum
CREATE TYPE "RedditBotProjectPostStatus" AS ENUM ('DOWNLOADED', 'MATCH', 'RELEVANT', 'DISCARDED');

-- CreateEnum
CREATE TYPE "RedditBotJobStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'KILLED');

-- CreateEnum
CREATE TYPE "RedditBotAiAnalysisRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'KILLED');

-- CreateEnum
CREATE TYPE "RedditBotAiAnalysisStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "RedditBotProject" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "productDescription" TEXT NOT NULL DEFAULT '',
    "subreddits" JSONB NOT NULL,
    "keywords" JSONB NOT NULL,

    CONSTRAINT "RedditBotProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedditBotAuthor" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redditUsername" TEXT NOT NULL,
    "profileUrl" TEXT NOT NULL,

    CONSTRAINT "RedditBotAuthor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedditBotPost" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redditId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "postLink" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "subreddit" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3),

    CONSTRAINT "RedditBotPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedditBotProjectPost" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "status" "RedditBotProjectPostStatus" NOT NULL DEFAULT 'DOWNLOADED',
    "painPointSummary" TEXT,
    "matchedKeywords" JSONB,
    "aiAnalysisStatus" "RedditBotAiAnalysisStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "aiAnalysisErrorMessage" TEXT,
    "aiReasoning" TEXT,
    "lastExportedAt" TIMESTAMP(3),
    "jobId" TEXT,

    CONSTRAINT "RedditBotProjectPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedditBotSchedule" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cronExpression" TEXT,
    "runAtTime" TEXT,
    "config" JSONB,
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),

    CONSTRAINT "RedditBotSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedditBotJob" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "status" "RedditBotJobStatus" NOT NULL DEFAULT 'RUNNING',
    "uniqueCount" INTEGER NOT NULL DEFAULT 0,
    "keywordMatchCount" INTEGER NOT NULL DEFAULT 0,
    "totalProcessed" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "stopRequestedAt" TIMESTAMP(3),
    "config" JSONB,
    "redditApiCalls" INTEGER NOT NULL DEFAULT 0,
    "redditCreditsUsed" DECIMAL(12,4) NOT NULL DEFAULT 0,

    CONSTRAINT "RedditBotJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedditBotAiAnalysisRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    "triggerSource" TEXT NOT NULL,
    "explorationJobId" TEXT,
    "filterSnapshot" JSONB,
    "status" "RedditBotAiAnalysisRunStatus" NOT NULL DEFAULT 'RUNNING',
    "totalToProcess" INTEGER NOT NULL DEFAULT 0,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "stopRequestedAt" TIMESTAMP(3),

    CONSTRAINT "RedditBotAiAnalysisRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedditSettings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "RedditSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedditCreditAccount" (
    "userId" TEXT NOT NULL,
    "balance" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "totalUsed" DECIMAL(12,4) NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "RedditCreditTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(12,4) NOT NULL,
    "reason" TEXT NOT NULL,
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RedditCreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RedditBotAuthor_redditUsername_key" ON "RedditBotAuthor"("redditUsername");

-- CreateIndex
CREATE UNIQUE INDEX "RedditBotPost_redditId_key" ON "RedditBotPost"("redditId");

-- CreateIndex
CREATE UNIQUE INDEX "RedditBotProjectPost_projectId_postId_key" ON "RedditBotProjectPost"("projectId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "RedditSettings_key_key" ON "RedditSettings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "RedditCreditAccount_userId_key" ON "RedditCreditAccount"("userId");

-- AddForeignKey
ALTER TABLE "RedditBotProject" ADD CONSTRAINT "RedditBotProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedditBotPost" ADD CONSTRAINT "RedditBotPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "RedditBotAuthor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedditBotProjectPost" ADD CONSTRAINT "RedditBotProjectPost_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RedditBotProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedditBotProjectPost" ADD CONSTRAINT "RedditBotProjectPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "RedditBotPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedditBotProjectPost" ADD CONSTRAINT "RedditBotProjectPost_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "RedditBotJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedditBotSchedule" ADD CONSTRAINT "RedditBotSchedule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RedditBotProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedditBotJob" ADD CONSTRAINT "RedditBotJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RedditBotProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedditBotJob" ADD CONSTRAINT "RedditBotJob_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "RedditBotSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedditBotAiAnalysisRun" ADD CONSTRAINT "RedditBotAiAnalysisRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RedditBotProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedditCreditAccount" ADD CONSTRAINT "RedditCreditAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedditCreditTransaction" ADD CONSTRAINT "RedditCreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedditCreditTransaction" ADD CONSTRAINT "RedditCreditTransaction_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "RedditBotJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default settings
INSERT INTO "RedditSettings" ("id", "key", "value") VALUES
  (gen_random_uuid()::text, 'credits.defaultForNewUser', '100'),
  (gen_random_uuid()::text, 'credits.perApiCall', '1'),
  (gen_random_uuid()::text, 'ai.enabled', 'false'),
  (gen_random_uuid()::text, 'ai.ollama.baseUrl', 'null'),
  (gen_random_uuid()::text, 'ai.ollama.model', 'null')
ON CONFLICT ("key") DO NOTHING;
