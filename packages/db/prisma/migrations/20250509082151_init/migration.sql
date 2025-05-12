-- CreateTable
CREATE TABLE "ListingRaw" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "extId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "json" JSONB NOT NULL,

    CONSTRAINT "ListingRaw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Score" (
    "listingId" TEXT NOT NULL,
    "alignment" DOUBLE PRECISION NOT NULL,
    "missing" TEXT[],

    CONSTRAINT "Score_pkey" PRIMARY KEY ("listingId")
);

-- CreateTable
CREATE TABLE "Valuation" (
    "listingId" TEXT NOT NULL,
    "valueIndex" DOUBLE PRECISION NOT NULL,
    "deltaPct" DOUBLE PRECISION NOT NULL,
    "dom" INTEGER NOT NULL,
    "hot" BOOLEAN NOT NULL,

    CONSTRAINT "Valuation_pkey" PRIMARY KEY ("listingId")
);

-- CreateTable
CREATE TABLE "Criterion" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "must" BOOLEAN NOT NULL,
    "pattern" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Criterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtlError" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EtlError_pkey" PRIMARY KEY ("id")
);
