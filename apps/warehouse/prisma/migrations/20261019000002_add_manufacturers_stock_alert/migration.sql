-- CreateTable
CREATE TABLE "warehouse"."manufacturers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,

    CONSTRAINT "manufacturers_pkey" PRIMARY KEY ("id")
);

-- Migrate existing free-text manufacturer values into the new table (no data lost)
INSERT INTO "warehouse"."manufacturers" (id, name)
SELECT gen_random_uuid()::text, m.manufacturer
FROM (
  SELECT DISTINCT manufacturer
  FROM "warehouse"."items"
  WHERE manufacturer IS NOT NULL AND manufacturer <> ''
) m;

-- AlterTable: add manufacturerId + stockAlert, make name optional
ALTER TABLE "warehouse"."items"
  ADD COLUMN "manufacturerId" TEXT,
  ADD COLUMN "stockAlert" BOOLEAN NOT NULL DEFAULT false,
  ALTER COLUMN "name" DROP NOT NULL;

-- Link existing items to their migrated manufacturer row
UPDATE "warehouse"."items" i
SET "manufacturerId" = m.id
FROM "warehouse"."manufacturers" m
WHERE i.manufacturer = m.name;

-- Drop the old free-text column now that data is preserved in "manufacturers"
ALTER TABLE "warehouse"."items" DROP COLUMN "manufacturer";

-- AddForeignKey
ALTER TABLE "warehouse"."items" ADD CONSTRAINT "items_manufacturerId_fkey"
  FOREIGN KEY ("manufacturerId") REFERENCES "warehouse"."manufacturers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "items_manufacturerId_idx" ON "warehouse"."items"("manufacturerId");
