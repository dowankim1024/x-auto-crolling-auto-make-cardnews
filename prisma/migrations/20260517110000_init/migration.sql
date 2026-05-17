-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RawPostStatus" AS ENUM ('NEW', 'TRANSLATING', 'TRANSLATED', 'ACCEPTED', 'REJECTED', 'IGNORED', 'ERROR');

-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('GENERAL', 'POLL', 'TODAY_DEBATE');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ImageProvider" AS ENUM ('WIKIMEDIA_COMMONS', 'UNSPLASH', 'PEXELS', 'PIXABAY', 'INTERNAL_ASSET', 'ADMIN_UPLOAD');

-- CreateEnum
CREATE TYPE "ImageLicenseSafety" AS ENUM ('SAFE_NO_RESTRICTIONS', 'SAFE_WITH_ATTRIBUTION', 'REVIEW_SAME_LICENSE', 'BLOCKED_OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CardNewsStatus" AS ENUM ('DRAFT', 'IMAGE_PENDING', 'READY_TO_RENDER', 'RENDERED', 'APPROVED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "SourceAccount" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT,
    "sportType" TEXT NOT NULL,
    "sourceTier" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawPost" (
    "id" TEXT NOT NULL,
    "sourceAccountId" TEXT,
    "externalPostId" TEXT NOT NULL,
    "originalText" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "language" TEXT,
    "rawJson" JSONB,
    "status" "RawPostStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RawPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranslatedPost" (
    "id" TEXT NOT NULL,
    "rawPostId" TEXT NOT NULL,
    "translatedText" TEXT NOT NULL,
    "oneLineSummary" TEXT NOT NULL,
    "shortSummary" TEXT,
    "detectedTeams" TEXT[],
    "detectedPlayers" TEXT[],
    "detectedKeywords" TEXT[],
    "suggestedPostType" "PostType" NOT NULL,
    "suggestedRumorStatus" TEXT,
    "riskFlags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranslatedPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleDraft" (
    "id" TEXT NOT NULL,
    "rawPostId" TEXT NOT NULL,
    "postType" "PostType" NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sourceName" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "rumorStatus" TEXT,
    "teamTags" TEXT[],
    "playerTags" TEXT[],
    "hashtags" TEXT[],
    "pollQuestion" TEXT,
    "pollAgreeText" TEXT,
    "pollDisagreeText" TEXT,
    "status" "DraftStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageAsset" (
    "id" TEXT NOT NULL,
    "provider" "ImageProvider" NOT NULL,
    "providerAssetId" TEXT,
    "title" TEXT,
    "imageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "sourcePageUrl" TEXT,
    "authorName" TEXT,
    "licenseName" TEXT,
    "licenseUrl" TEXT,
    "creditText" TEXT NOT NULL,
    "licenseSafety" "ImageLicenseSafety" NOT NULL,
    "commercialUseAllowed" BOOLEAN NOT NULL DEFAULT false,
    "modificationAllowed" BOOLEAN NOT NULL DEFAULT false,
    "requiresAttribution" BOOLEAN NOT NULL DEFAULT true,
    "requiresShareAlike" BOOLEAN NOT NULL DEFAULT false,
    "hasIdentifiablePerson" BOOLEAN NOT NULL DEFAULT false,
    "hasLogoOrTrademark" BOOLEAN NOT NULL DEFAULT false,
    "usageAllowed" BOOLEAN NOT NULL DEFAULT false,
    "adminApproved" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardNewsDraft" (
    "id" TEXT NOT NULL,
    "articleDraftId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "instagramHashtags" TEXT[],
    "status" "CardNewsStatus" NOT NULL DEFAULT 'DRAFT',
    "renderedImageUrls" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardNewsDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardSlide" (
    "id" TEXT NOT NULL,
    "cardNewsDraftId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "templateType" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "body" TEXT,
    "footnote" TEXT,
    "imageAssetId" TEXT,
    "renderedImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardSlide_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SourceAccount_handle_key" ON "SourceAccount"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "RawPost_externalPostId_key" ON "RawPost"("externalPostId");

-- CreateIndex
CREATE INDEX "RawPost_sourceAccountId_idx" ON "RawPost"("sourceAccountId");

-- CreateIndex
CREATE INDEX "RawPost_postedAt_idx" ON "RawPost"("postedAt");

-- CreateIndex
CREATE INDEX "RawPost_status_idx" ON "RawPost"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TranslatedPost_rawPostId_key" ON "TranslatedPost"("rawPostId");

-- CreateIndex
CREATE INDEX "ArticleDraft_rawPostId_idx" ON "ArticleDraft"("rawPostId");

-- CreateIndex
CREATE INDEX "ArticleDraft_status_idx" ON "ArticleDraft"("status");

-- CreateIndex
CREATE INDEX "ImageAsset_provider_idx" ON "ImageAsset"("provider");

-- CreateIndex
CREATE INDEX "ImageAsset_licenseSafety_idx" ON "ImageAsset"("licenseSafety");

-- CreateIndex
CREATE INDEX "ImageAsset_adminApproved_idx" ON "ImageAsset"("adminApproved");

-- CreateIndex
CREATE INDEX "CardNewsDraft_articleDraftId_idx" ON "CardNewsDraft"("articleDraftId");

-- CreateIndex
CREATE INDEX "CardNewsDraft_status_idx" ON "CardNewsDraft"("status");

-- CreateIndex
CREATE INDEX "CardSlide_imageAssetId_idx" ON "CardSlide"("imageAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "CardSlide_cardNewsDraftId_order_key" ON "CardSlide"("cardNewsDraftId", "order");

-- AddForeignKey
ALTER TABLE "RawPost" ADD CONSTRAINT "RawPost_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "SourceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranslatedPost" ADD CONSTRAINT "TranslatedPost_rawPostId_fkey" FOREIGN KEY ("rawPostId") REFERENCES "RawPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleDraft" ADD CONSTRAINT "ArticleDraft_rawPostId_fkey" FOREIGN KEY ("rawPostId") REFERENCES "RawPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardNewsDraft" ADD CONSTRAINT "CardNewsDraft_articleDraftId_fkey" FOREIGN KEY ("articleDraftId") REFERENCES "ArticleDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardSlide" ADD CONSTRAINT "CardSlide_cardNewsDraftId_fkey" FOREIGN KEY ("cardNewsDraftId") REFERENCES "CardNewsDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardSlide" ADD CONSTRAINT "CardSlide_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "ImageAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
