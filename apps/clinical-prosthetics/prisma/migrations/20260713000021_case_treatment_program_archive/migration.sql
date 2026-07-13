ALTER TABLE clinic_prosthetics.case_treatment_programs
  ADD COLUMN IF NOT EXISTS "archivedAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archiveNotes" TEXT;
