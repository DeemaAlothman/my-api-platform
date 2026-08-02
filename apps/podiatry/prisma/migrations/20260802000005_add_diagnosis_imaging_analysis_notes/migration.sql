-- Migration: add diagnosis, imagingProcedures, newAnalysisNotes, oldAnalysisNotes
ALTER TABLE clinic_podiatry.podiatry_receptions
  ADD COLUMN IF NOT EXISTS "diagnosis"         TEXT,
  ADD COLUMN IF NOT EXISTS "imagingProcedures" TEXT,
  ADD COLUMN IF NOT EXISTS "newAnalysisNotes"  TEXT,
  ADD COLUMN IF NOT EXISTS "oldAnalysisNotes"  TEXT;
