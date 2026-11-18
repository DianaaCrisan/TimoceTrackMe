-- The filling pack waits once it holds this many orders, and the next order
-- starts a new pack. See docs/background-work-visibility-plan.md, phase 3.

-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN "packMaxOrders" INTEGER NOT NULL DEFAULT 200;
