-- Add diagnosis field and imaging procedures to medical_histories

ALTER TABLE "clinic_physio"."medical_histories"
  ADD COLUMN IF NOT EXISTS "diagnosis"          TEXT,
  ADD COLUMN IF NOT EXISTS "imagingProcedures"  JSONB;
