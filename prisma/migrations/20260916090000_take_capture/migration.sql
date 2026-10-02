-- CreateEnum
CREATE TYPE "CaptureStatus" AS ENUM ('NOT_STARTED', 'CAPTURED', 'SKIPPED');

-- Remove the Step 1 Take -> Shot relationship. The database was verified to contain no Take rows.
ALTER TABLE "Shot" DROP CONSTRAINT "Shot_selectedTakeId_fkey";
ALTER TABLE "Take" DROP CONSTRAINT "Take_shotId_fkey";
DROP INDEX "Shot_selectedTakeId_key";
DROP INDEX "Take_shotId_idx";
ALTER TABLE "Shot" DROP COLUMN "selectedTakeId";
ALTER TABLE "Take" DROP COLUMN "shotId";

-- Add capture state and the selected take to PlannedShot.
ALTER TABLE "PlannedShot"
  ADD COLUMN "captureStatus" "CaptureStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "selectedTakeId" TEXT;

-- Store server-verified Take metadata and link each Take to its PlannedShot.
ALTER TABLE "Take"
  ADD COLUMN "plannedShotId" TEXT NOT NULL,
  ADD COLUMN "width" INTEGER NOT NULL,
  ADD COLUMN "height" INTEGER NOT NULL,
  ADD COLUMN "mimeType" TEXT NOT NULL,
  ADD COLUMN "fileSize" INTEGER NOT NULL;

CREATE UNIQUE INDEX "PlannedShot_selectedTakeId_key" ON "PlannedShot"("selectedTakeId");
CREATE INDEX "Take_plannedShotId_createdAt_idx" ON "Take"("plannedShotId", "createdAt");

ALTER TABLE "Take" ADD CONSTRAINT "Take_plannedShotId_fkey"
  FOREIGN KEY ("plannedShotId") REFERENCES "PlannedShot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlannedShot" ADD CONSTRAINT "PlannedShot_selectedTakeId_fkey"
  FOREIGN KEY ("selectedTakeId") REFERENCES "Take"("id") ON DELETE SET NULL ON UPDATE CASCADE;
