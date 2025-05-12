-- AlterTable
ALTER TABLE "Criterion" ADD COLUMN     "synonyms" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Score" ADD COLUMN     "locationBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "partials" JSONB;
