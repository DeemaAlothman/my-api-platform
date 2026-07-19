ALTER TABLE clinic_patients.patients
  ADD COLUMN IF NOT EXISTS "neighborhood" TEXT;
