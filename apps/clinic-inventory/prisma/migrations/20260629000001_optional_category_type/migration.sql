ALTER TABLE "clinic_inventory"."inventory_items"
  ALTER COLUMN "categoryId" DROP NOT NULL,
  ALTER COLUMN "type" DROP NOT NULL;
