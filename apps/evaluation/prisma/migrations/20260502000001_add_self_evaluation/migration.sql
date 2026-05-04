-- Add PENDING_SELF_EVALUATION to ProbationStatus enum
ALTER TYPE evaluation."ProbationStatus" ADD VALUE IF NOT EXISTS 'PENDING_SELF_EVALUATION' BEFORE 'PENDING_SENIOR_MANAGER';

-- Add selfScore column to ProbationCriteriaScore
ALTER TABLE evaluation."ProbationCriteriaScore"
  ADD COLUMN IF NOT EXISTS "selfScore" evaluation."ProbationRating";

-- Make score nullable
ALTER TABLE evaluation."ProbationCriteriaScore"
  ALTER COLUMN score DROP NOT NULL;
