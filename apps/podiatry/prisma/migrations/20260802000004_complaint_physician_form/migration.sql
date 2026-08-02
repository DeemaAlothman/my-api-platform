-- Migration: add Physician's Medical Form complaint fields
ALTER TABLE clinic_podiatry.podiatry_receptions
  ADD COLUMN IF NOT EXISTS "mainComplaint"       TEXT,
  ADD COLUMN IF NOT EXISTS "startDate"           TEXT,
  ADD COLUMN IF NOT EXISTS "possibleCause"       TEXT,
  ADD COLUMN IF NOT EXISTS "previousDoctor"      TEXT,
  ADD COLUMN IF NOT EXISTS "previousTreatment"   TEXT,
  ADD COLUMN IF NOT EXISTS "symptomsBetterTime"  TEXT,
  ADD COLUMN IF NOT EXISTS "symptomsWorseTime"   TEXT,
  ADD COLUMN IF NOT EXISTS "painType"            TEXT,
  ADD COLUMN IF NOT EXISTS "painLevel"           TEXT,
  ADD COLUMN IF NOT EXISTS "painTrend"           TEXT,
  ADD COLUMN IF NOT EXISTS "hadInjuryBefore"     BOOLEAN;
