/*
  Warnings:

  - The primary key for the `Valuation` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `deltaPct` on the `Valuation` table. All the data in the column will be lost.
  - You are about to drop the column `dom` on the `Valuation` table. All the data in the column will be lost.
  - You are about to drop the column `hot` on the `Valuation` table. All the data in the column will be lost.
  - You are about to drop the column `listingId` on the `Valuation` table. All the data in the column will be lost.
  - You are about to alter the column `valueIndex` on the `Valuation` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(6,2)`.
  - A unique constraint covering the columns `[extId,site]` on the table `ListingRaw` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[listingExtId,site]` on the table `Score` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `listingExtId` to the `Valuation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `site` to the `Valuation` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Site" AS ENUM ('ZILLOW', 'TRULIA');

-- DropForeignKey
ALTER TABLE "Score" DROP CONSTRAINT "Score_listingExtId_fkey";

-- DropIndex
DROP INDEX "ListingRaw_extId_key";

-- DropIndex
DROP INDEX "Score_listingExtId_key";

-- AlterTable
ALTER TABLE "ListingRaw" ADD COLUMN     "site" "Site" NOT NULL DEFAULT 'ZILLOW';

-- AlterTable
ALTER TABLE "Score" ADD COLUMN     "site" "Site" NOT NULL DEFAULT 'ZILLOW';

-- AlterTable
ALTER TABLE "Valuation" DROP CONSTRAINT "Valuation_pkey",
DROP COLUMN "deltaPct",
DROP COLUMN "dom",
DROP COLUMN "hot",
DROP COLUMN "listingId",
ADD COLUMN     "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "listingExtId" TEXT NOT NULL,
ADD COLUMN     "rawScore" DECIMAL(6,2),
ADD COLUMN     "signals" JSONB,
ADD COLUMN     "site" "Site" NOT NULL,
ALTER COLUMN "valueIndex" DROP NOT NULL,
ALTER COLUMN "valueIndex" SET DATA TYPE DECIMAL(6,2),
ADD CONSTRAINT "Valuation_pkey" PRIMARY KEY ("listingExtId", "site");

-- CreateIndex
CREATE UNIQUE INDEX "ListingRaw_extId_site_key" ON "ListingRaw"("extId", "site");

-- CreateIndex
CREATE UNIQUE INDEX "Score_listingExtId_site_key" ON "Score"("listingExtId", "site");

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_listingExtId_site_fkey" FOREIGN KEY ("listingExtId", "site") REFERENCES "ListingRaw"("extId", "site") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valuation" ADD CONSTRAINT "Valuation_listingExtId_site_fkey" FOREIGN KEY ("listingExtId", "site") REFERENCES "ListingRaw"("extId", "site") ON DELETE RESTRICT ON UPDATE CASCADE;
