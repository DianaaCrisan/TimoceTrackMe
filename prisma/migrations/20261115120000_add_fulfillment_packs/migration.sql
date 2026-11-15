-- CreateEnum
CREATE TYPE "FulfillmentPackStatus" AS ENUM ('OPEN', 'LOCKED', 'CLOSED');

-- CreateTable
CREATE TABLE "FulfillmentPack" (
    "id" TEXT NOT NULL,
    "status" "FulfillmentPackStatus" NOT NULL DEFAULT 'OPEN',
    "day" DATE NOT NULL,
    "daySequence" INTEGER NOT NULL,
    "orderTag" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "FulfillmentPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FulfillmentPackOrder" (
    "orderId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taggedAt" TIMESTAMP(3),

    CONSTRAINT "FulfillmentPackOrder_pkey" PRIMARY KEY ("orderId")
);

-- CreateIndex
CREATE UNIQUE INDEX "FulfillmentPack_orderTag_key" ON "FulfillmentPack"("orderTag");

-- CreateIndex
CREATE UNIQUE INDEX "FulfillmentPack_day_daySequence_key" ON "FulfillmentPack"("day", "daySequence");

-- CreateIndex
CREATE INDEX "FulfillmentPackOrder_packId_idx" ON "FulfillmentPackOrder"("packId");

-- AddForeignKey
ALTER TABLE "FulfillmentPackOrder" ADD CONSTRAINT "FulfillmentPackOrder_packId_fkey" FOREIGN KEY ("packId") REFERENCES "FulfillmentPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

