-- DropIndex
DROP INDEX "lm_leave_day_userId_projectId_dateString_key";

-- CreateIndex
CREATE UNIQUE INDEX "lm_leave_day_userId_projectId_dateString_categoryId_key" ON "lm_leave_day"("userId", "projectId", "dateString", "categoryId");
