-- Step 5: deterministic checks, multimodal evaluation, and explicit user acceptance.
CREATE TYPE "EvaluationStatus" AS ENUM ('PENDING', 'EVALUATING', 'PASSED', 'NEEDS_RETAKE', 'FAILED');
CREATE TYPE "TakeAcceptanceStatus" AS ENUM ('NOT_ACCEPTED', 'AI_PASSED', 'USER_ACCEPTED');
CREATE TYPE "EvaluationCriticalIssue" AS ENUM ('SUBJECT_MISSING', 'KEY_ACTION_MISSING', 'PRODUCT_NOT_VISIBLE', 'SEVERELY_OUT_OF_FRAME', 'UNUSABLE_VISIBILITY', 'WRONG_SHOT_CONTENT');

ALTER TABLE "Take" ADD COLUMN "acceptanceStatus" "TakeAcceptanceStatus" NOT NULL DEFAULT 'NOT_ACCEPTED';

-- Takes selected before Step 5 were explicitly accepted by the user during Step 4.
UPDATE "Take" AS t
SET "acceptanceStatus" = 'USER_ACCEPTED'
FROM "PlannedShot" AS ps
WHERE ps."selectedTakeId" = t.id;

ALTER TABLE "Evaluation"
  ALTER COLUMN "passed" DROP NOT NULL,
  ALTER COLUMN "score" DROP NOT NULL,
  ALTER COLUMN "advice" DROP NOT NULL,
  ALTER COLUMN "rawResult" DROP NOT NULL,
  ADD COLUMN "status" "EvaluationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "overallScore" INTEGER,
  ADD COLUMN "framingScore" INTEGER,
  ADD COLUMN "actionScore" INTEGER,
  ADD COLUMN "movementScore" INTEGER,
  ADD COLUMN "timingScore" INTEGER,
  ADD COLUMN "visibilityScore" INTEGER,
  ADD COLUMN "criticalIssues" "EvaluationCriticalIssue"[] NOT NULL DEFAULT ARRAY[]::"EvaluationCriticalIssue"[],
  ADD COLUMN "mainIssueCode" TEXT,
  ADD COLUMN "confidence" DOUBLE PRECISION,
  ADD COLUMN "evidence" TEXT,
  ADD COLUMN "issueStartTime" DOUBLE PRECISION,
  ADD COLUMN "issueEndTime" DOUBLE PRECISION,
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "model" TEXT,
  ADD COLUMN "error" TEXT,
  ADD COLUMN "evaluationToken" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "evaluatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Evaluation_evaluationToken_key" ON "Evaluation"("evaluationToken");

ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_overallScore_range" CHECK ("overallScore" IS NULL OR "overallScore" BETWEEN 0 AND 100);
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_framingScore_range" CHECK ("framingScore" IS NULL OR "framingScore" BETWEEN 0 AND 100);
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_actionScore_range" CHECK ("actionScore" IS NULL OR "actionScore" BETWEEN 0 AND 100);
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_movementScore_range" CHECK ("movementScore" IS NULL OR "movementScore" BETWEEN 0 AND 100);
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_timingScore_range" CHECK ("timingScore" IS NULL OR "timingScore" BETWEEN 0 AND 100);
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_visibilityScore_range" CHECK ("visibilityScore" IS NULL OR "visibilityScore" BETWEEN 0 AND 100);
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_confidence_range" CHECK ("confidence" IS NULL OR "confidence" BETWEEN 0 AND 1);
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_issue_time_range" CHECK (
  ("issueStartTime" IS NULL OR "issueStartTime" >= 0) AND
  ("issueEndTime" IS NULL OR "issueEndTime" >= 0) AND
  ("issueStartTime" IS NULL OR "issueEndTime" IS NULL OR "issueEndTime" >= "issueStartTime")
);

-- Prisma's @updatedAt column is maintained by the client and does not keep a database default.
ALTER TABLE "Evaluation" ALTER COLUMN "updatedAt" DROP DEFAULT;
