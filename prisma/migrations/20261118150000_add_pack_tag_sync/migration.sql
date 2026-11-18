-- Pack tag work moves from an in-memory queue to the database, so a restart
-- loses nothing and the app can show progress. See
-- docs/background-work-visibility-plan.md, phase 1.

-- CreateEnum
CREATE TYPE "PackTagSyncStatus" AS ENUM ('PENDING', 'FAILED');

-- CreateTable
CREATE TABLE "PackTagSync" (
    "orderId" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "staleTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "PackTagSyncStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batchId" TEXT,

    CONSTRAINT "PackTagSync_pkey" PRIMARY KEY ("orderId")
);

-- CreateTable
CREATE TABLE "PackTagBatch" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "packId" TEXT,
    "orderIds" TEXT[],
    "orderCount" INTEGER NOT NULL,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taggedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "PackTagBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PackTagSync_status_requestedAt_idx" ON "PackTagSync"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "PackTagSync_batchId_idx" ON "PackTagSync"("batchId");

-- CreateIndex
CREATE INDEX "PackTagBatch_finishedAt_idx" ON "PackTagBatch"("finishedAt");

-- AddForeignKey
ALTER TABLE "PackTagSync" ADD CONSTRAINT "PackTagSync_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PackTagBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: orders whose pack tags were never confirmed join the new flow,
-- so the worker tags them on its first run. The app serves one shop, read
-- from its offline session; without one there is nothing to tag with, and
-- the pack's Retry button queues them later. A moved order whose old tag
-- was never removed is not known here, so its old tag stays.
INSERT INTO "PackTagSync" ("orderId", "shop")
SELECT o."orderId", s."shop"
FROM "FulfillmentPackOrder" o
CROSS JOIN (
    SELECT "shop" FROM "Session" WHERE "isOnline" = false ORDER BY "id" LIMIT 1
) s
WHERE o."taggedAt" IS NULL;
