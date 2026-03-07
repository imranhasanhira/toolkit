-- CreateTable
CREATE TABLE "UserAppPermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "appKey" TEXT NOT NULL,

    CONSTRAINT "UserAppPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAppPermission_userId_appKey_key" ON "UserAppPermission"("userId", "appKey");

-- AddForeignKey
ALTER TABLE "UserAppPermission" ADD CONSTRAINT "UserAppPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
