/*
  Warnings:

  - A unique constraint covering the columns `[extId]` on the table `ListingRaw` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ListingRaw_extId_key" ON "ListingRaw"("extId");
