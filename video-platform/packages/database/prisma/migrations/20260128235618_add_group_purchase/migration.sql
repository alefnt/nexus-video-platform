/*
  Warnings:

  - You are about to alter the column `amount` on the `PointsTransaction` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Integer`.
  - You are about to drop the `Entitlement` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Entitlement" DROP CONSTRAINT "Entitlement_userId_fkey";

-- DropForeignKey
ALTER TABLE "Entitlement" DROP CONSTRAINT "Entitlement_videoId_fkey";

-- AlterTable
ALTER TABLE "PointsTransaction" ADD COLUMN     "txType" TEXT,
ADD COLUMN     "videoId" TEXT,
ALTER COLUMN "amount" SET DATA TYPE INTEGER;

-- DropTable
DROP TABLE "Entitlement";

-- CreateTable
CREATE TABLE "video_entitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "purchaseType" TEXT NOT NULL DEFAULT 'points',
    "grantedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyTask" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "maxDaily" INTEGER NOT NULL DEFAULT 1,
    "requirement" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTaskProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "rewardClaimed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTaskProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckinRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "streak" INTEGER NOT NULL DEFAULT 1,
    "bonusMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckinRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FanLevel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "watchTime" INTEGER NOT NULL DEFAULT 0,
    "tipAmount" INTEGER NOT NULL DEFAULT 0,
    "interactions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FanLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NFTDrop" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "nftType" TEXT NOT NULL,
    "nftName" TEXT NOT NULL,
    "imageUrl" TEXT,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "sporeId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "NFTDrop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveReward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "rewardType" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDailyLimit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "actionType" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "lastIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDailyLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuspiciousActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" JSONB,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuspiciousActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "video_entitlement_userId_videoId_key" ON "video_entitlement"("userId", "videoId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyTask_type_key" ON "DailyTask"("type");

-- CreateIndex
CREATE INDEX "UserTaskProgress_userId_date_idx" ON "UserTaskProgress"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "UserTaskProgress_userId_taskType_date_key" ON "UserTaskProgress"("userId", "taskType", "date");

-- CreateIndex
CREATE INDEX "CheckinRecord_userId_idx" ON "CheckinRecord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckinRecord_userId_date_key" ON "CheckinRecord"("userId", "date");

-- CreateIndex
CREATE INDEX "FanLevel_creatorId_level_idx" ON "FanLevel"("creatorId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "FanLevel_userId_creatorId_key" ON "FanLevel"("userId", "creatorId");

-- CreateIndex
CREATE INDEX "NFTDrop_userId_claimed_idx" ON "NFTDrop"("userId", "claimed");

-- CreateIndex
CREATE INDEX "LiveReward_userId_roomId_createdAt_idx" ON "LiveReward"("userId", "roomId", "createdAt");

-- CreateIndex
CREATE INDEX "UserDailyLimit_userId_date_idx" ON "UserDailyLimit"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "UserDailyLimit_userId_date_actionType_key" ON "UserDailyLimit"("userId", "date", "actionType");

-- CreateIndex
CREATE INDEX "SuspiciousActivity_userId_createdAt_idx" ON "SuspiciousActivity"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PointsTransaction_userId_videoId_idx" ON "PointsTransaction"("userId", "videoId");

-- AddForeignKey
ALTER TABLE "video_entitlement" ADD CONSTRAINT "video_entitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_entitlement" ADD CONSTRAINT "video_entitlement_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
