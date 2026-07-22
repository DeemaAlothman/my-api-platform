ALTER TABLE clinic_patients.patients
  ADD COLUMN IF NOT EXISTS "documentConsent" TEXT,
  ADD COLUMN IF NOT EXISTS "mediaConsent"    BOOLEAN;
