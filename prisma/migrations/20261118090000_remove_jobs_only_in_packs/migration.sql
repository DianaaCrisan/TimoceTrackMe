-- Add tracking and print labels now always run from a pack, so the setting
-- that made it optional is gone. See docs/fulfillment-packs-plan.md.

-- AlterTable
ALTER TABLE "AppSettings" DROP COLUMN "jobsOnlyInPacks";
