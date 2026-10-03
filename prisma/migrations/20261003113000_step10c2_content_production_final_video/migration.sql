-- Step 10C-2: allow the unified final-video pipeline to render a content production plan.
CREATE TYPE "FinalVideoSourceType" AS ENUM ('REFERENCE_PROJECT', 'CONTENT_PRODUCTION');
ALTER TYPE "FinalVideoStatus" ADD VALUE IF NOT EXISTS 'OUTDATED';
ALTER TABLE "FinalVideo" ADD COLUMN "sourceType" "FinalVideoSourceType" NOT NULL DEFAULT 'REFERENCE_PROJECT';
ALTER TABLE "FinalVideo" ADD COLUMN "productionPlanId" TEXT;
ALTER TABLE "FinalVideo" ALTER COLUMN "projectId" DROP NOT NULL;
CREATE UNIQUE INDEX "FinalVideo_productionPlanId_key" ON "FinalVideo"("productionPlanId");
ALTER TABLE "FinalVideo" ADD CONSTRAINT "FinalVideo_productionPlanId_fkey" FOREIGN KEY ("productionPlanId") REFERENCES "ProductionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoRenderSettings" ADD COLUMN "productionPlanId" TEXT;
ALTER TABLE "VideoRenderSettings" ALTER COLUMN "projectId" DROP NOT NULL;
CREATE UNIQUE INDEX "VideoRenderSettings_productionPlanId_key" ON "VideoRenderSettings"("productionPlanId");
ALTER TABLE "VideoRenderSettings" ADD CONSTRAINT "VideoRenderSettings_productionPlanId_fkey" FOREIGN KEY ("productionPlanId") REFERENCES "ProductionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubtitleTrack" ADD COLUMN "productionPlanId" TEXT;
ALTER TABLE "SubtitleTrack" ALTER COLUMN "projectId" DROP NOT NULL;
ALTER TABLE "SubtitleTrack" ADD CONSTRAINT "SubtitleTrack_productionPlanId_fkey" FOREIGN KEY ("productionPlanId") REFERENCES "ProductionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
