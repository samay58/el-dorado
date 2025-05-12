-- CreateTable
CREATE TABLE "RedfinZipMetric" (
    "id" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "periodBegin" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "regionType" TEXT,
    "medianSalePrice" DOUBLE PRECISION,
    "medianPricePerSqFt" DOUBLE PRECISION,
    "medianDom" INTEGER,
    "homesSold" INTEGER,
    "inventory" DOUBLE PRECISION,
    "monthsOfSupply" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RedfinZipMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZillowZhviZip" (
    "id" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "regionName" TEXT,
    "month" TIMESTAMP(3) NOT NULL,
    "zhvi" DOUBLE PRECISION,
    "zhviAppreciation12Mo" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZillowZhviZip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RealtorHotnessZip" (
    "id" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "rankNational" INTEGER,
    "rankState" INTEGER,
    "hotnessScore" DOUBLE PRECISION,
    "demandScore" DOUBLE PRECISION,
    "supplyScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RealtorHotnessZip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSfPropertySale" (
    "id" TEXT NOT NULL,
    "apn" TEXT NOT NULL,
    "closeOfEscrowDate" TIMESTAMP(3) NOT NULL,
    "salePrice" DOUBLE PRECISION NOT NULL,
    "propertyAddress" TEXT,
    "propertyZipCode" TEXT,
    "assessedValue" DOUBLE PRECISION,
    "propertyClassCode" TEXT,
    "propertyType" TEXT,
    "bedrooms" INTEGER,
    "bathrooms" DOUBLE PRECISION,
    "squareFootage" INTEGER,
    "lotSizeSqFt" INTEGER,
    "yearBuilt" INTEGER,
    "dataSourceUrl" TEXT,
    "recordedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSfPropertySale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RedfinZipMetric_zipCode_idx" ON "RedfinZipMetric"("zipCode");

-- CreateIndex
CREATE INDEX "RedfinZipMetric_periodEnd_idx" ON "RedfinZipMetric"("periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "RedfinZipMetric_zipCode_periodEnd_key" ON "RedfinZipMetric"("zipCode", "periodEnd");

-- CreateIndex
CREATE INDEX "ZillowZhviZip_zipCode_idx" ON "ZillowZhviZip"("zipCode");

-- CreateIndex
CREATE INDEX "ZillowZhviZip_month_idx" ON "ZillowZhviZip"("month");

-- CreateIndex
CREATE UNIQUE INDEX "ZillowZhviZip_zipCode_month_key" ON "ZillowZhviZip"("zipCode", "month");

-- CreateIndex
CREATE INDEX "RealtorHotnessZip_zipCode_idx" ON "RealtorHotnessZip"("zipCode");

-- CreateIndex
CREATE INDEX "RealtorHotnessZip_month_idx" ON "RealtorHotnessZip"("month");

-- CreateIndex
CREATE UNIQUE INDEX "RealtorHotnessZip_zipCode_month_key" ON "RealtorHotnessZip"("zipCode", "month");

-- CreateIndex
CREATE INDEX "DataSfPropertySale_apn_idx" ON "DataSfPropertySale"("apn");

-- CreateIndex
CREATE INDEX "DataSfPropertySale_propertyZipCode_idx" ON "DataSfPropertySale"("propertyZipCode");

-- CreateIndex
CREATE INDEX "DataSfPropertySale_closeOfEscrowDate_idx" ON "DataSfPropertySale"("closeOfEscrowDate");

-- CreateIndex
CREATE UNIQUE INDEX "DataSfPropertySale_apn_closeOfEscrowDate_salePrice_key" ON "DataSfPropertySale"("apn", "closeOfEscrowDate", "salePrice");
