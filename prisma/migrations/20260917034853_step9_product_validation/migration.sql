-- CreateEnum
CREATE TYPE "TesterType" AS ENUM ('SHOP_OWNER', 'ECOMMERCE_SELLER', 'CREATOR', 'PERSONAL_IP', 'OTHER');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'EXPERIENCED');

-- CreateEnum
CREATE TYPE "UserTestStatus" AS ENUM ('STARTED', 'DROPPED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PricingVariant" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "FeedbackStage" AS ENUM ('REFERENCE', 'BRIEF', 'PLAN', 'SHOOT', 'EVALUATION', 'RENDER', 'RESULT', 'PRICING');

-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('CONFUSING', 'AI_INCORRECT', 'ERROR', 'SLOW', 'OTHER');

-- CreateTable
CREATE TABLE "ProductEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "sessionId" TEXT,
    "eventName" TEXT NOT NULL,
    "eventData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTestSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "testerLabel" TEXT NOT NULL,
    "testerType" "TesterType" NOT NULL,
    "experienceLevel" "ExperienceLevel" NOT NULL,
    "intendedContent" TEXT NOT NULL,
    "status" "UserTestStatus" NOT NULL DEFAULT 'STARTED',
    "pricingVariant" "PricingVariant" NOT NULL DEFAULT 'B',
    "selectedPlan" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "observerNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTestSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestFeedback" (
    "id" TEXT NOT NULL,
    "testSessionId" TEXT NOT NULL,
    "priorAbility" TEXT NOT NULL,
    "mostHelpful" TEXT NOT NULL,
    "mostDifficult" TEXT NOT NULL,
    "reuseIntent" TEXT NOT NULL,
    "publishIntent" TEXT NOT NULL,
    "dissatisfaction" TEXT,
    "recommendScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "stage" "FeedbackStage" NOT NULL,
    "category" "FeedbackCategory" NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageLedger" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "userId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "inputUnits" DOUBLE PRECISION,
    "outputUnits" DOUBLE PRECISION,
    "credits" DOUBLE PRECISION,
    "currencyCost" DOUBLE PRECISION,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductEvent_eventName_createdAt_idx" ON "ProductEvent"("eventName", "createdAt");

-- CreateIndex
CREATE INDEX "ProductEvent_projectId_createdAt_idx" ON "ProductEvent"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductEvent_sessionId_createdAt_idx" ON "ProductEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserTestSession_projectId_key" ON "UserTestSession"("projectId");

-- CreateIndex
CREATE INDEX "UserTestSession_status_startedAt_idx" ON "UserTestSession"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TestFeedback_testSessionId_key" ON "TestFeedback"("testSessionId");

-- CreateIndex
CREATE INDEX "UserFeedback_projectId_createdAt_idx" ON "UserFeedback"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "UsageLedger_projectId_createdAt_idx" ON "UsageLedger"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "UsageLedger_provider_operation_createdAt_idx" ON "UsageLedger"("provider", "operation", "createdAt");

-- AddForeignKey
ALTER TABLE "ProductEvent" ADD CONSTRAINT "ProductEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductEvent" ADD CONSTRAINT "ProductEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductEvent" ADD CONSTRAINT "ProductEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "UserTestSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTestSession" ADD CONSTRAINT "UserTestSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTestSession" ADD CONSTRAINT "UserTestSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestFeedback" ADD CONSTRAINT "TestFeedback_testSessionId_fkey" FOREIGN KEY ("testSessionId") REFERENCES "UserTestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFeedback" ADD CONSTRAINT "UserFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFeedback" ADD CONSTRAINT "UserFeedback_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLedger" ADD CONSTRAINT "UsageLedger_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLedger" ADD CONSTRAINT "UsageLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
