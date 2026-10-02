-- CreateEnum
CREATE TYPE "TalentMode" AS ENUM ('SELF', 'OTHER_PERSON', 'PRODUCT_ONLY');

-- CreateEnum
CREATE TYPE "ShootingPlanStatus" AS ENUM ('GENERATING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "PlannedShotDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateTable
CREATE TABLE "ShootingBrief" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "talentMode" "TalentMode" NOT NULL,
    "location" TEXT NOT NULL,
    "goal" TEXT NOT NULL DEFAULT '保留参考视频的节奏和拍法，把内容改成适合我的版本。',
    "additionalContext" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShootingBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShootingPlan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "status" "ShootingPlanStatus" NOT NULL DEFAULT 'GENERATING',
    "generationError" TEXT,
    "generationToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShootingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedShot" (
    "id" TEXT NOT NULL,
    "shootingPlanId" TEXT NOT NULL,
    "referenceShotId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "actionInstruction" TEXT NOT NULL,
    "cameraInstruction" TEXT NOT NULL,
    "dialogue" TEXT,
    "targetDuration" DOUBLE PRECISION NOT NULL,
    "difficulty" "PlannedShotDifficulty" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannedShot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShootingBrief_projectId_key" ON "ShootingBrief"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ShootingPlan_projectId_key" ON "ShootingPlan"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ShootingPlan_briefId_key" ON "ShootingPlan"("briefId");

-- CreateIndex
CREATE INDEX "PlannedShot_referenceShotId_idx" ON "PlannedShot"("referenceShotId");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedShot_shootingPlanId_order_key" ON "PlannedShot"("shootingPlanId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedShot_shootingPlanId_referenceShotId_key" ON "PlannedShot"("shootingPlanId", "referenceShotId");

-- AddForeignKey
ALTER TABLE "ShootingBrief" ADD CONSTRAINT "ShootingBrief_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShootingPlan" ADD CONSTRAINT "ShootingPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShootingPlan" ADD CONSTRAINT "ShootingPlan_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ShootingBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedShot" ADD CONSTRAINT "PlannedShot_shootingPlanId_fkey" FOREIGN KEY ("shootingPlanId") REFERENCES "ShootingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedShot" ADD CONSTRAINT "PlannedShot_referenceShotId_fkey" FOREIGN KEY ("referenceShotId") REFERENCES "Shot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
