SET search_path TO clinic_podiatry;

ALTER TABLE podiatry_receptions
  ADD COLUMN IF NOT EXISTS "reviewNotes"    TEXT,
  ADD COLUMN IF NOT EXISTS "doctorDecision" TEXT;
