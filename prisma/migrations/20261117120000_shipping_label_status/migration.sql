-- The AWB report takes each AWB's status from Shopify (used / cancelled) and
-- also lists AWBs pasted into Shopify or added by hand. See
-- docs/awb-report-plan.md. Rows saved so far are kept: every one was booked
-- by TrackMe; it is used if it reached Shopify, otherwise cancelled.

-- CreateEnum
CREATE TYPE "ShippingLabelSource" AS ENUM ('TRACKME', 'SHOPIFY', 'IMPORT');

-- CreateEnum
CREATE TYPE "ShippingLabelCourier" AS ENUM ('OPTIMUS', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ShippingLabelStatus" AS ENUM ('USED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShippingLabelCancelReason" AS ENUM ('FULFILLMENT_CANCELLED', 'TRACKING_REMOVED', 'NEVER_ON_SHOPIFY', 'SET_BY_HAND');

-- AlterTable: new columns, nullable until filled in
ALTER TABLE "ShippingLabel"
ADD COLUMN     "source" "ShippingLabelSource",
ADD COLUMN     "courier" "ShippingLabelCourier",
ADD COLUMN     "trackingCompany" TEXT,
ADD COLUMN     "fulfillmentId" TEXT,
ADD COLUMN     "status" "ShippingLabelStatus",
ADD COLUMN     "cancelReason" "ShippingLabelCancelReason",
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "issuedAt" TIMESTAMP(3),
ADD COLUMN     "note" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- Existing rows: booked by TrackMe at Optimus
UPDATE "ShippingLabel" SET
  "source" = 'TRACKME',
  "courier" = 'OPTIMUS',
  "trackingCompany" = 'Optimus',
  "issuedAt" = "generatedAt",
  "updatedAt" = CURRENT_TIMESTAMP,
  "status" = CASE WHEN "addedToShopifyAt" IS NULL THEN 'CANCELLED'::"ShippingLabelStatus" ELSE 'USED'::"ShippingLabelStatus" END,
  "cancelReason" = CASE WHEN "addedToShopifyAt" IS NULL THEN 'NEVER_ON_SHOPIFY'::"ShippingLabelCancelReason" ELSE NULL END,
  "cancelledAt" = CASE WHEN "addedToShopifyAt" IS NULL THEN "generatedAt" ELSE NULL END;

ALTER TABLE "ShippingLabel"
ALTER COLUMN "source" SET NOT NULL,
ALTER COLUMN "courier" SET NOT NULL,
ALTER COLUMN "status" SET NOT NULL,
ALTER COLUMN "issuedAt" SET NOT NULL,
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "orderId" DROP NOT NULL,
ALTER COLUMN "orderName" DROP NOT NULL,
ALTER COLUMN "orderCreatedAt" DROP NOT NULL,
ALTER COLUMN "fulfillmentOrderId" DROP NOT NULL,
ALTER COLUMN "weightKg" DROP NOT NULL;

-- DropIndex
DROP INDEX "ShippingLabel_generatedAt_idx";

-- AlterTable
ALTER TABLE "ShippingLabel" DROP COLUMN "addedToShopifyAt",
DROP COLUMN "generatedAt";

-- CreateTable
CREATE TABLE "AwbReportSync" (
    "month" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwbReportSync_pkey" PRIMARY KEY ("month")
);

-- CreateIndex
CREATE INDEX "ShippingLabel_issuedAt_idx" ON "ShippingLabel"("issuedAt");

-- CreateIndex
CREATE INDEX "ShippingLabel_orderId_idx" ON "ShippingLabel"("orderId");
