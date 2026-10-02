CREATE TYPE "TrimSource" AS ENUM ('AUTO', 'USER', 'FULL_TAKE');

CREATE TABLE "TrimDecision" (
  "id" TEXT NOT NULL,
  "takeId" TEXT NOT NULL,
  "startTime" DOUBLE PRECISION NOT NULL,
  "endTime" DOUBLE PRECISION NOT NULL,
  "trimmedDuration" DOUBLE PRECISION NOT NULL,
  "source" "TrimSource" NOT NULL,
  "confidence" DOUBLE PRECISION,
  "reason" TEXT,
  "actionStartTime" DOUBLE PRECISION,
  "actionEndTime" DOUBLE PRECISION,
  "analysisDurationMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrimDecision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrimDecision_takeId_key" ON "TrimDecision"("takeId");
ALTER TABLE "TrimDecision" ADD CONSTRAINT "TrimDecision_takeId_fkey" FOREIGN KEY ("takeId") REFERENCES "Take"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinalVideo" ADD COLUMN "renderDurationMs" INTEGER;
