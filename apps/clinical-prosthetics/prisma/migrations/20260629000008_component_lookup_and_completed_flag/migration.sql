ALTER TABLE "clinic_prosthetics"."prosthesis_components"
  ALTER COLUMN "inventoryItemId" DROP NOT NULL;

ALTER TABLE "clinic_prosthetics"."prosthetics_cases"
  ADD COLUMN IF NOT EXISTS "prosthesisCompleted" BOOLEAN NOT NULL DEFAULT false;
