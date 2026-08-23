SET search_path TO clinic_prosthetics;

ALTER TABLE lower_limb_assessments
  ADD COLUMN IF NOT EXISTS "phantomSensationPresent" BOOLEAN;
