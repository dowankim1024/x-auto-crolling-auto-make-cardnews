-- CreateEnum
CREATE TYPE "FootballBriefingStatus" AS ENUM ('OFFICIAL', 'RUMOUR', 'UPDATE', 'CONFIRMED', 'DENIED');

-- CreateEnum
CREATE TYPE "AiBriefingRoute" AS ENUM ('AUTO_PUBLISH', 'REVIEW_QUEUE', 'IGNORE');

-- CreateEnum
CREATE TYPE "AiProcessingStatus" AS ENUM ('COMPLETED', 'ERROR');

-- CreateEnum
CREATE TYPE "PublishQueueStatus" AS ENUM ('READY', 'PUBLISHED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReviewQueueStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "AiBriefing" (
    "id" TEXT NOT NULL,
    "rawPostId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summaryShort" TEXT NOT NULL,
    "summaryDetail" TEXT NOT NULL,
    "teamTags" TEXT[],
    "briefingStatus" "FootballBriefingStatus" NOT NULL,
    "route" "AiBriefingRoute" NOT NULL,
    "decisionReason" TEXT NOT NULL,
    "aiModel" TEXT NOT NULL,
    "aiRawResponse" JSONB NOT NULL,
    "processingStatus" "AiProcessingStatus" NOT NULL DEFAULT 'COMPLETED',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiBriefing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishQueueItem" (
    "id" TEXT NOT NULL,
    "aiBriefingId" TEXT NOT NULL,
    "status" "PublishQueueStatus" NOT NULL DEFAULT 'READY',
    "title" TEXT NOT NULL,
    "summaryShort" TEXT NOT NULL,
    "summaryDetail" TEXT NOT NULL,
    "teamTags" TEXT[],
    "briefingStatus" "FootballBriefingStatus" NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "publishTarget" TEXT,
    "externalPostUrl" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewQueueItem" (
    "id" TEXT NOT NULL,
    "aiBriefingId" TEXT NOT NULL,
    "status" "ReviewQueueStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summaryShort" TEXT NOT NULL,
    "summaryDetail" TEXT NOT NULL,
    "teamTags" TEXT[],
    "briefingStatus" "FootballBriefingStatus" NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiBriefing_rawPostId_key" ON "AiBriefing"("rawPostId");

-- CreateIndex
CREATE INDEX "AiBriefing_briefingStatus_idx" ON "AiBriefing"("briefingStatus");

-- CreateIndex
CREATE INDEX "AiBriefing_route_idx" ON "AiBriefing"("route");

-- CreateIndex
CREATE INDEX "AiBriefing_processingStatus_idx" ON "AiBriefing"("processingStatus");

-- CreateIndex
CREATE INDEX "AiBriefing_createdAt_idx" ON "AiBriefing"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublishQueueItem_aiBriefingId_key" ON "PublishQueueItem"("aiBriefingId");

-- CreateIndex
CREATE INDEX "PublishQueueItem_status_idx" ON "PublishQueueItem"("status");

-- CreateIndex
CREATE INDEX "PublishQueueItem_createdAt_idx" ON "PublishQueueItem"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewQueueItem_aiBriefingId_key" ON "ReviewQueueItem"("aiBriefingId");

-- CreateIndex
CREATE INDEX "ReviewQueueItem_status_idx" ON "ReviewQueueItem"("status");

-- CreateIndex
CREATE INDEX "ReviewQueueItem_reason_idx" ON "ReviewQueueItem"("reason");

-- CreateIndex
CREATE INDEX "ReviewQueueItem_createdAt_idx" ON "ReviewQueueItem"("createdAt");

-- AddForeignKey
ALTER TABLE "AiBriefing" ADD CONSTRAINT "AiBriefing_rawPostId_fkey" FOREIGN KEY ("rawPostId") REFERENCES "RawPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishQueueItem" ADD CONSTRAINT "PublishQueueItem_aiBriefingId_fkey" FOREIGN KEY ("aiBriefingId") REFERENCES "AiBriefing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewQueueItem" ADD CONSTRAINT "ReviewQueueItem_aiBriefingId_fkey" FOREIGN KEY ("aiBriefingId") REFERENCES "AiBriefing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
