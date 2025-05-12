-- CreateEnum
CREATE TYPE "ScrapeRunStatus" AS ENUM ('IN_PROGRESS', 'SUCCESS', 'ERROR');

-- CreateTable
CREATE TABLE "ScrapeRun" (
    "id" TEXT NOT NULL,
    "site" "Site" NOT NULL,
    "mode" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "ScrapeRunStatus" NOT NULL DEFAULT 'IN_PROGRESS',

    CONSTRAINT "ScrapeRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScrapeRun_site_mode_startedAt_idx" ON "ScrapeRun"("site", "mode", "startedAt");
