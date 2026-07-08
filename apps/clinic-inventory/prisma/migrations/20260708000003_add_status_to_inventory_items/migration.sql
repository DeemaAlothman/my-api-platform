CREATE TYPE clinic_inventory."ItemRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DONE', 'NOT_AVAILABLE');

ALTER TABLE clinic_inventory.inventory_items
  ADD COLUMN IF NOT EXISTS "status" clinic_inventory."ItemRequestStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "requestedByUserId" TEXT;
