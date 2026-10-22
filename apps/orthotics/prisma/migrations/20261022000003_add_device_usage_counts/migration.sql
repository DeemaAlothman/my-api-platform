ALTER TABLE "clinic_orthotics"."orthotics_receptions"
  ADD COLUMN "deviceUsageCounts" JSONB NOT NULL DEFAULT '{}';
