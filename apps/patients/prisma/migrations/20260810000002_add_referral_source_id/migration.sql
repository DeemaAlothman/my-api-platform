ALTER TABLE clinic_patients.patients
  ADD COLUMN IF NOT EXISTS "referralSourceId" TEXT;
