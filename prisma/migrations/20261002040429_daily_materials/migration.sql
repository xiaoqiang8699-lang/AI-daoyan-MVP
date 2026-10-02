-- CreateEnum
CREATE TYPE "MaterialBatchStatus" AS ENUM ('UPLOADING', 'READY', 'ANALYZING', 'ANALYZED', 'FAILED');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('VIDEO', 'IMAGE');

-- CreateEnum
CREATE TYPE "MaterialAssetStatus" AS ENUM ('UPLOADING', 'READY', 'ANALYZING', 'ANALYZED', 'FAILED');

-- CreateEnum
CREATE TYPE "CapturedAtSource" AS ENUM ('MEDIA_METADATA', 'USER_UPLOAD', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MaterialVisualQuality" AS ENUM ('GOOD', 'USABLE', 'POOR');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('PRODUCT', 'DAILY_VLOG', 'STORY', 'KNOWLEDGE', 'BEHIND_THE_SCENES', 'OTHER');

-- CreateEnum
CREATE TYPE "ContentOpportunityStatus" AS ENUM ('READY', 'NEEDS_MORE_MATERIAL', 'SELECTED', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED', 'OUTDATED');

-- CreateEnum
CREATE TYPE "OpportunitySegmentRole" AS ENUM ('HOOK', 'CONTEXT', 'ACTION', 'DETAIL', 'REACTION', 'PROOF', 'ENDING');

-- CreateEnum
CREATE TYPE "DiscoveryGoal" AS ENUM ('EXPLORE', 'PRODUCT', 'PERSONAL_IP', 'DAILY_VLOG');

-- CreateTable
CREATE TABLE "MaterialBatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "status" "MaterialBatchStatus" NOT NULL DEFAULT 'UPLOADING',
    "goal" "DiscoveryGoal" NOT NULL DEFAULT 'EXPLORE',
    "analysisStartedAt" TIMESTAMP(3),
    "analysisCompletedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialAsset" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "type" "MaterialType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "duration" DOUBLE PRECISION,
    "width" INTEGER,
    "height" INTEGER,
    "capturedAt" TIMESTAMP(3),
    "capturedAtSource" "CapturedAtSource" NOT NULL DEFAULT 'USER_UPLOAD',
    "thumbnailStorageKey" TEXT,
    "thumbnailUrl" TEXT,
    "analysisStatus" "MaterialAssetStatus" NOT NULL DEFAULT 'UPLOADING',
    "analysisError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialAnalysis" (
    "id" TEXT NOT NULL,
    "materialAssetId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "scene" TEXT,
    "activity" TEXT,
    "objects" JSONB,
    "topics" JSONB,
    "speechSummary" TEXT,
    "visualQuality" "MaterialVisualQuality" NOT NULL,
    "storyPotential" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "rawResult" JSONB,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryEvent" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventMaterial" (
    "eventId" TEXT NOT NULL,
    "materialAssetId" TEXT NOT NULL,
    "relevanceScore" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "EventMaterial_pkey" PRIMARY KEY ("eventId","materialAssetId")
);

-- CreateTable
CREATE TABLE "ContentOpportunity" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "storyEventId" TEXT,
    "title" TEXT NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "angle" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "targetDuration" DOUBLE PRECISION NOT NULL,
    "sufficiencyScore" INTEGER NOT NULL,
    "status" "ContentOpportunityStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunitySegment" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "materialAssetId" TEXT,
    "role" "OpportunitySegmentRole" NOT NULL,
    "suggestedStart" DOUBLE PRECISION,
    "suggestedEnd" DOUBLE PRECISION,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunitySegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissingMaterialRequest" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "actionInstruction" TEXT NOT NULL,
    "cameraInstruction" TEXT NOT NULL,
    "targetDuration" DOUBLE PRECISION NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissingMaterialRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaterialBatch_userId_businessDate_idx" ON "MaterialBatch"("userId", "businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialAsset_storageKey_key" ON "MaterialAsset"("storageKey");

-- CreateIndex
CREATE INDEX "MaterialAsset_batchId_createdAt_idx" ON "MaterialAsset"("batchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialAnalysis_materialAssetId_key" ON "MaterialAnalysis"("materialAssetId");

-- CreateIndex
CREATE INDEX "StoryEvent_batchId_createdAt_idx" ON "StoryEvent"("batchId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentOpportunity_batchId_status_idx" ON "ContentOpportunity"("batchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunitySegment_opportunityId_order_key" ON "OpportunitySegment"("opportunityId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "MissingMaterialRequest_opportunityId_order_key" ON "MissingMaterialRequest"("opportunityId", "order");

-- AddForeignKey
ALTER TABLE "MaterialBatch" ADD CONSTRAINT "MaterialBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialAsset" ADD CONSTRAINT "MaterialAsset_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "MaterialBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialAnalysis" ADD CONSTRAINT "MaterialAnalysis_materialAssetId_fkey" FOREIGN KEY ("materialAssetId") REFERENCES "MaterialAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryEvent" ADD CONSTRAINT "StoryEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "MaterialBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMaterial" ADD CONSTRAINT "EventMaterial_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "StoryEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMaterial" ADD CONSTRAINT "EventMaterial_materialAssetId_fkey" FOREIGN KEY ("materialAssetId") REFERENCES "MaterialAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentOpportunity" ADD CONSTRAINT "ContentOpportunity_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "MaterialBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentOpportunity" ADD CONSTRAINT "ContentOpportunity_storyEventId_fkey" FOREIGN KEY ("storyEventId") REFERENCES "StoryEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunitySegment" ADD CONSTRAINT "OpportunitySegment_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "ContentOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunitySegment" ADD CONSTRAINT "OpportunitySegment_materialAssetId_fkey" FOREIGN KEY ("materialAssetId") REFERENCES "MaterialAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissingMaterialRequest" ADD CONSTRAINT "MissingMaterialRequest_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "ContentOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
