-- CreateEnum
CREATE TYPE "ProductionPlanStatus" AS ENUM ('ACTIVE', 'MATERIALS_READY', 'OUTDATED');

-- CreateEnum
CREATE TYPE "CaptureTaskSourceType" AS ENUM ('REFERENCE_PLANNED_SHOT', 'OPPORTUNITY_MISSING_MATERIAL');

-- CreateEnum
CREATE TYPE "CaptureTaskStatus" AS ENUM ('NOT_STARTED', 'CAPTURED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Take" ADD COLUMN     "captureTaskId" TEXT,
ALTER COLUMN "plannedShotId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ProductionPlan" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "angle" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "targetDuration" DOUBLE PRECISION NOT NULL,
    "status" "ProductionPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaptureTask" (
    "id" TEXT NOT NULL,
    "productionPlanId" TEXT NOT NULL,
    "sourceType" "CaptureTaskSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "actionInstruction" TEXT NOT NULL,
    "cameraInstruction" TEXT NOT NULL,
    "targetDuration" DOUBLE PRECISION NOT NULL,
    "referenceImageUrl" TEXT,
    "referenceVideoUrl" TEXT,
    "status" "CaptureTaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "selectedTakeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaptureTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductionPlan_opportunityId_key" ON "ProductionPlan"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "CaptureTask_selectedTakeId_key" ON "CaptureTask"("selectedTakeId");

-- CreateIndex
CREATE INDEX "CaptureTask_productionPlanId_status_idx" ON "CaptureTask"("productionPlanId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CaptureTask_productionPlanId_order_key" ON "CaptureTask"("productionPlanId", "order");

-- CreateIndex
CREATE INDEX "Take_captureTaskId_createdAt_idx" ON "Take"("captureTaskId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProductionPlan" ADD CONSTRAINT "ProductionPlan_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "ContentOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptureTask" ADD CONSTRAINT "CaptureTask_productionPlanId_fkey" FOREIGN KEY ("productionPlanId") REFERENCES "ProductionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptureTask" ADD CONSTRAINT "CaptureTask_selectedTakeId_fkey" FOREIGN KEY ("selectedTakeId") REFERENCES "Take"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Take" ADD CONSTRAINT "Take_captureTaskId_fkey" FOREIGN KEY ("captureTaskId") REFERENCES "CaptureTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
