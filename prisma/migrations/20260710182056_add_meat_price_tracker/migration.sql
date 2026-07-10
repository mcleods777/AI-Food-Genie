-- CreateTable
CREATE TABLE "PriceSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "zipCode" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeatPrice" (
    "id" TEXT NOT NULL,
    "store" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "cut" TEXT NOT NULL,
    "grade" TEXT NOT NULL DEFAULT 'Ungraded',
    "pricePerLb" DOUBLE PRECISION,
    "totalPrice" DOUBLE PRECISION,
    "packSize" TEXT,
    "onSale" BOOLEAN NOT NULL DEFAULT false,
    "saleNote" TEXT,
    "sourceNote" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "linkUrl" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeatPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PriceSetting_userId_key" ON "PriceSetting"("userId");

-- CreateIndex
CREATE INDEX "MeatPrice_batchId_idx" ON "MeatPrice"("batchId");

-- CreateIndex
CREATE INDEX "MeatPrice_fetchedAt_idx" ON "MeatPrice"("fetchedAt");

-- CreateIndex
CREATE INDEX "MeatPrice_cut_grade_idx" ON "MeatPrice"("cut", "grade");

