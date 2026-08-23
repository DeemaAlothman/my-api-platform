SET search_path TO clinic_podiatry;

ALTER TABLE podiatry_sessions
  ADD COLUMN IF NOT EXISTS "subjectiveHistory" JSONB,
  ADD COLUMN IF NOT EXISTS "visualInspection"  JSONB,
  ADD COLUMN IF NOT EXISTS "palpation"         JSONB,
  ADD COLUMN IF NOT EXISTS "rangeOfMotion"     JSONB,
  ADD COLUMN IF NOT EXISTS "dynamicAnalysis"   JSONB,
  ADD COLUMN IF NOT EXISTS "shoeWearPattern"   JSONB,
  ADD COLUMN IF NOT EXISTS "footMeasurements"  JSONB,
  ADD COLUMN IF NOT EXISTS "insoleType"        TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "doctorDecision"    TEXT,
  ADD COLUMN IF NOT EXISTS "notes"             TEXT;
