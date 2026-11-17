-- CreateTable
CREATE TABLE "ShippingLabel" (
    "trackingNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderName" TEXT NOT NULL,
    "orderCreatedAt" TIMESTAMP(3) NOT NULL,
    "fulfillmentOrderId" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "parcelPosition" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "addedToShopifyAt" TIMESTAMP(3),
    "firstPrintedAt" TIMESTAMP(3),
    "lastPrintedAt" TIMESTAMP(3),
    "printCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ShippingLabel_pkey" PRIMARY KEY ("trackingNumber")
);

-- CreateIndex
CREATE INDEX "ShippingLabel_generatedAt_idx" ON "ShippingLabel"("generatedAt");

