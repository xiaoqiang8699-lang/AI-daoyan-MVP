-- AlterEnum
ALTER TYPE "ProjectStatus" ADD VALUE 'ANALYSIS_FAILED';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "analysisError" TEXT,
ADD COLUMN     "analysisProvider" TEXT,
ADD COLUMN     "analysisStartedAt" TIMESTAMP(3),
ADD COLUMN     "analysisToken" TEXT;

-- AlterTable
ALTER TABLE "ReferenceVideo" ADD COLUMN     "codec" TEXT,
ADD COLUMN     "fps" DOUBLE PRECISION,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "originalName" TEXT,
ADD COLUMN     "size" INTEGER,
ADD COLUMN     "storageKey" TEXT,
ADD COLUMN     "width" INTEGER;

-- AlterTable
ALTER TABLE "Shot" ADD COLUMN     "visualDescription" TEXT NOT NULL DEFAULT '';
