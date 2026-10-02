ALTER TABLE "MissingMaterialRequest" ADD COLUMN "reason" TEXT NOT NULL DEFAULT '';

ALTER TABLE "MissingMaterialRequest" ALTER COLUMN "reason" DROP DEFAULT;
