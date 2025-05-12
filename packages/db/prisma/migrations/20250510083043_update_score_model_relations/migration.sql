/*
  Warnings:

  - The primary key for the `Score` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `alignment` on the `Score` table. All the data in the column will be lost.
  - You are about to drop the column `listingId` on the `Score` table. All the data in the column will be lost.
  - You are about to drop the column `missing` on the `Score` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[listingExtId]` on the table `Score` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `alignmentScore` to the `Score` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `Score` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `listingExtId` to the `Score` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Score" DROP CONSTRAINT "Score_pkey",
DROP COLUMN "alignment",
DROP COLUMN "listingId",
DROP COLUMN "missing",
ADD COLUMN     "alignmentScore" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "listingExtId" TEXT NOT NULL,
ADD COLUMN     "matchedCriteriaKeys" TEXT[],
ADD COLUMN     "missingMusts" TEXT[],
ADD COLUMN     "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD CONSTRAINT "Score_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "Score_listingExtId_key" ON "Score"("listingExtId");

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_listingExtId_fkey" FOREIGN KEY ("listingExtId") REFERENCES "ListingRaw"("extId") ON DELETE RESTRICT ON UPDATE CASCADE;
