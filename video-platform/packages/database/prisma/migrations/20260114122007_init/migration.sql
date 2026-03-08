-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "did" TEXT,
    "address" TEXT,
    "nickname" TEXT,
    "avatar" TEXT,
    "bio" TEXT,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "points" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverUrl" TEXT,
    "videoUrl" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "size" INTEGER NOT NULL DEFAULT 0,
    "encryptionKeyHash" TEXT,
    "sha256" TEXT,
    "cfStreamUid" TEXT,
    "cfPlaybackHls" TEXT,
    "arweaveTxId" TEXT,
    "filecoinCid" TEXT,
    "pricePerMin" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isNftGated" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveRoom" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "coverUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "viewerCount" INTEGER NOT NULL DEFAULT 0,
    "peakViewers" INTEGER NOT NULL DEFAULT 0,
    "totalTips" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isRecording" BOOLEAN NOT NULL DEFAULT false,
    "recordingUrl" TEXT,
    "creatorId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "ticketPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paymentMode" TEXT NOT NULL DEFAULT 'ticket',
    "pricePerMinute" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "LiveRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveRoomTicket" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveRoomTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveTip" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "giftId" TEXT,
    "message" TEXT,
    "fromUserId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveTip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveStreamSession" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "lastTickAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalSeconds" INTEGER NOT NULL DEFAULT 0,
    "totalCharged" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "preAuthAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "LiveStreamSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NFTCollection" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "symbol" TEXT,
    "creatorId" TEXT NOT NULL,
    "totalSupply" INTEGER NOT NULL DEFAULT 0,
    "maxSupply" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NFTCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "category" TEXT,
    "tier" TEXT,
    "condition" TEXT,
    "pointsReward" INTEGER NOT NULL DEFAULT 0,
    "benefits" TEXT,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "sporeId" TEXT,
    "txHash" TEXT,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStat" (
    "userId" TEXT NOT NULL,
    "totalVideos" INTEGER NOT NULL DEFAULT 0,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "totalLikes" INTEGER NOT NULL DEFAULT 0,
    "totalTipsReceived" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalSubscribers" INTEGER NOT NULL DEFAULT 0,
    "totalWatchTime" INTEGER NOT NULL DEFAULT 0,
    "totalTipsSent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalCollections" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "totalShares" INTEGER NOT NULL DEFAULT 0,
    "totalReferrals" INTEGER NOT NULL DEFAULT 0,
    "consecutiveLoginDays" INTEGER NOT NULL DEFAULT 0,
    "liveStreamCount" INTEGER NOT NULL DEFAULT 0,
    "nftMintCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStat_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "proposerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "support" BOOLEAN NOT NULL,
    "power" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BridgeTransfer" (
    "id" TEXT NOT NULL,
    "fromChain" TEXT NOT NULL,
    "toChain" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "txHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BridgeTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointsTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointsTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyingIntent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expectedAmountShannons" TEXT NOT NULL,
    "expectedAmountCKB" TEXT NOT NULL,
    "pointsToCredit" DECIMAL(65,30) NOT NULL,
    "depositAddress" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "txHash" TEXT,
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "payerAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuyingIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiberInvoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invoice" TEXT NOT NULL,
    "paymentHash" TEXT,
    "amount" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "pointsToCredit" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL,
    "credited" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiberInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoTip" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toCreatorAddress" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "message" TEXT,
    "showDanmaku" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoTip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreamSession" (
    "sessionId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoDurationSeconds" INTEGER NOT NULL,
    "pricePerMinute" DECIMAL(65,30) NOT NULL,
    "segmentMinutes" INTEGER NOT NULL,
    "totalSegments" INTEGER NOT NULL,
    "currentSegment" INTEGER NOT NULL,
    "paidSegments" INTEGER[],
    "lastWatchedSegment" INTEGER NOT NULL,
    "totalPaid" DECIMAL(65,30) NOT NULL,
    "actualUsedSeconds" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "lastTickAt" TIMESTAMP(3) NOT NULL,
    "pausedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamSession_pkey" PRIMARY KEY ("sessionId")
);

-- CreateTable
CREATE TABLE "StreamInvoice" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "segmentNumber" INTEGER NOT NULL,
    "invoice" TEXT NOT NULL,
    "paymentHash" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreamInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_did_key" ON "User"("did");

-- CreateIndex
CREATE UNIQUE INDEX "User_address_key" ON "User"("address");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Entitlement_userId_videoId_key" ON "Entitlement"("userId", "videoId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveRoomTicket_userId_roomId_key" ON "LiveRoomTicket"("userId", "roomId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveStreamSession_roomId_viewerId_key" ON "LiveStreamSession"("roomId", "viewerId");

-- CreateIndex
CREATE UNIQUE INDEX "NFTCollection_clusterId_key" ON "NFTCollection"("clusterId");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_slug_key" ON "Achievement"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "BridgeTransfer_txHash_key" ON "BridgeTransfer"("txHash");

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveRoom" ADD CONSTRAINT "LiveRoom_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveRoomTicket" ADD CONSTRAINT "LiveRoomTicket_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "LiveRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveRoomTicket" ADD CONSTRAINT "LiveRoomTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveTip" ADD CONSTRAINT "LiveTip_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveTip" ADD CONSTRAINT "LiveTip_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "LiveRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveStreamSession" ADD CONSTRAINT "LiveStreamSession_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "LiveRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveStreamSession" ADD CONSTRAINT "LiveStreamSession_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NFTCollection" ADD CONSTRAINT "NFTCollection_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStat" ADD CONSTRAINT "UserStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BridgeTransfer" ADD CONSTRAINT "BridgeTransfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsTransaction" ADD CONSTRAINT "PointsTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyingIntent" ADD CONSTRAINT "BuyingIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiberInvoice" ADD CONSTRAINT "FiberInvoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoTip" ADD CONSTRAINT "VideoTip_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoTip" ADD CONSTRAINT "VideoTip_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamSession" ADD CONSTRAINT "StreamSession_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamSession" ADD CONSTRAINT "StreamSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamInvoice" ADD CONSTRAINT "StreamInvoice_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StreamSession"("sessionId") ON DELETE RESTRICT ON UPDATE CASCADE;
