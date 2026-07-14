-- تحسينات نموذج تحليل المشي
ALTER TABLE clinic_prosthetics.gait_analysis_forms
  ADD COLUMN IF NOT EXISTS "isSaved"                      BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "archivedAt"                   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archiveNotes"                 TEXT,
  ADD COLUMN IF NOT EXISTS "recommendationsNotes"         TEXT,
  ADD COLUMN IF NOT EXISTS "mainProblemNotes"             TEXT,
  ADD COLUMN IF NOT EXISTS "patientComplaintsOtherNotes"  TEXT,
  ADD COLUMN IF NOT EXISTS "suspensionSystemOtherNotes"   TEXT,
  ADD COLUMN IF NOT EXISTS "prostheticIssuesOtherNotes"   TEXT,
  ADD COLUMN IF NOT EXISTS "likelyCausesOtherNotes"       TEXT;

-- تحسينات نموذج تقييم التوازن
ALTER TABLE clinic_prosthetics.balance_assessment_forms
  ADD COLUMN IF NOT EXISTS "isSaved"                      BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "archivedAt"                   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archiveNotes"                 TEXT,
  ADD COLUMN IF NOT EXISTS "previousProsthesisNotes"      TEXT,
  ADD COLUMN IF NOT EXISTS "fallRiskNotes"                TEXT,
  ADD COLUMN IF NOT EXISTS "limitingFactorsOtherNotes"    TEXT;
