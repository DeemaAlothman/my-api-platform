-- Add meeting schedule fields to probation_evaluations
ALTER TABLE evaluation."ProbationEvaluation"
  ADD COLUMN IF NOT EXISTS "meetingProposedAt"         TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "meetingConfirmedByEmployee" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "meetingConfirmedByManager"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "meetingConfirmedAt"         TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "decisionDocumentUrl"        TEXT;

-- Add new enum values (must run outside transaction)
ALTER TYPE evaluation."ProbationStatus" ADD VALUE IF NOT EXISTS 'PENDING_MEETING_SCHEDULE';
ALTER TYPE evaluation."ProbationRecommendation" ADD VALUE IF NOT EXISTS 'SALARY_RAISE';
