-- Add PENDING_SELF_EVALUATION to ProbationStatus enum
ALTER TYPE evaluation."ProbationStatus" ADD VALUE IF NOT EXISTS 'PENDING_SELF_EVALUATION' BEFORE 'PENDING_SENIOR_MANAGER';

-- Add selfScore column to probation_criteria_scores
ALTER TABLE evaluation.probation_criteria_scores
  ADD COLUMN IF NOT EXISTS "selfScore" evaluation."ProbationRating";

-- Make score nullable (self-evaluation fills selfScore first, manager fills score later)
ALTER TABLE evaluation.probation_criteria_scores
  ALTER COLUMN score DROP NOT NULL;
