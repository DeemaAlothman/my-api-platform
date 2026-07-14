ALTER TABLE clinic_prosthetics.case_treatment_programs
  ADD COLUMN IF NOT EXISTS "alertNote"         TEXT,
  ADD COLUMN IF NOT EXISTS "alertSentAt"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "alertSentByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "alertResponseNote" TEXT,
  ADD COLUMN IF NOT EXISTS "alertRespondedAt"  TIMESTAMP(3);
