-- Add weighted score fields to ProbationEvaluation (70% manager / 30% self)
ALTER TABLE evaluation."ProbationEvaluation"
  ADD COLUMN IF NOT EXISTS "managerScorePercent" FLOAT,
  ADD COLUMN IF NOT EXISTS "selfScorePercent"    FLOAT,
  ADD COLUMN IF NOT EXISTS "finalScorePercent"   FLOAT,
  ADD COLUMN IF NOT EXISTS "managerWeight"       FLOAT NOT NULL DEFAULT 0.7,
  ADD COLUMN IF NOT EXISTS "selfWeight"          FLOAT NOT NULL DEFAULT 0.3;
