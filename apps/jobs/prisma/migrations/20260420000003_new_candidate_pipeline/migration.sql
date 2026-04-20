-- Migration: New Candidate Pipeline
-- Safely replaces CandidateStage enum values and adds new fields

-- Step 1: Drop default first, then convert enum columns to TEXT
ALTER TABLE jobs.candidates
  ALTER COLUMN "currentStage" DROP DEFAULT;

ALTER TABLE jobs.candidates
  ALTER COLUMN "currentStage" TYPE TEXT;

ALTER TABLE jobs.candidate_stage_history
  ALTER COLUMN "fromStage" TYPE TEXT,
  ALTER COLUMN "toStage"   TYPE TEXT;

-- Step 2: Map old stage values to new ones
UPDATE jobs.candidates SET "currentStage" = CASE "currentStage"
  WHEN 'NEW'                  THEN 'PENDING'
  WHEN 'INITIAL_REVIEW'       THEN 'PENDING'
  WHEN 'PHONE_INTERVIEW'      THEN 'ELIGIBLE_FOR_INTERVIEW'
  WHEN 'TECHNICAL_INTERVIEW'  THEN 'FINAL_ELIGIBLE'
  WHEN 'FINAL_INTERVIEW'      THEN 'CEO_APPROVAL'
  WHEN 'OFFER_SENT'           THEN 'REFERENCE_CHECK'
  WHEN 'WITHDRAWN'            THEN 'REJECTED'
  ELSE "currentStage"
END;

UPDATE jobs.candidate_stage_history SET "fromStage" = CASE "fromStage"
  WHEN 'NEW'                  THEN 'PENDING'
  WHEN 'INITIAL_REVIEW'       THEN 'PENDING'
  WHEN 'PHONE_INTERVIEW'      THEN 'ELIGIBLE_FOR_INTERVIEW'
  WHEN 'TECHNICAL_INTERVIEW'  THEN 'FINAL_ELIGIBLE'
  WHEN 'FINAL_INTERVIEW'      THEN 'CEO_APPROVAL'
  WHEN 'OFFER_SENT'           THEN 'REFERENCE_CHECK'
  WHEN 'WITHDRAWN'            THEN 'REJECTED'
  ELSE "fromStage"
END WHERE "fromStage" IS NOT NULL;

UPDATE jobs.candidate_stage_history SET "toStage" = CASE "toStage"
  WHEN 'NEW'                  THEN 'PENDING'
  WHEN 'INITIAL_REVIEW'       THEN 'PENDING'
  WHEN 'PHONE_INTERVIEW'      THEN 'ELIGIBLE_FOR_INTERVIEW'
  WHEN 'TECHNICAL_INTERVIEW'  THEN 'FINAL_ELIGIBLE'
  WHEN 'FINAL_INTERVIEW'      THEN 'CEO_APPROVAL'
  WHEN 'OFFER_SENT'           THEN 'REFERENCE_CHECK'
  WHEN 'WITHDRAWN'            THEN 'REJECTED'
  ELSE "toStage"
END;

-- Step 3: Drop old enum
DROP TYPE IF EXISTS jobs."CandidateStage";

-- Step 4: Create new enum
CREATE TYPE jobs."CandidateStage" AS ENUM (
  'PENDING',
  'ELIGIBLE_FOR_INTERVIEW',
  'FINAL_ELIGIBLE',
  'CEO_APPROVAL',
  'REFERENCE_CHECK',
  'HIRED',
  'REJECTED'
);

-- Step 5: Convert columns back to new enum
ALTER TABLE jobs.candidates
  ALTER COLUMN "currentStage" TYPE jobs."CandidateStage"
  USING "currentStage"::jobs."CandidateStage";

ALTER TABLE jobs.candidates
  ALTER COLUMN "currentStage" SET DEFAULT 'PENDING'::jobs."CandidateStage";

ALTER TABLE jobs.candidate_stage_history
  ALTER COLUMN "fromStage" TYPE jobs."CandidateStage"
  USING "fromStage"::jobs."CandidateStage",
  ALTER COLUMN "toStage"   TYPE jobs."CandidateStage"
  USING "toStage"::jobs."CandidateStage";

-- Step 6: Add reference fields to candidates
ALTER TABLE jobs.candidates
  ADD COLUMN IF NOT EXISTS "reference1Name"  TEXT,
  ADD COLUMN IF NOT EXISTS "reference1Phone" TEXT,
  ADD COLUMN IF NOT EXISTS "reference2Name"  TEXT,
  ADD COLUMN IF NOT EXISTS "reference2Phone" TEXT;

-- Step 7: Add new fields to interview_evaluations
ALTER TABLE jobs.interview_evaluations
  ADD COLUMN IF NOT EXISTS "additionalConditions"    TEXT,
  ADD COLUMN IF NOT EXISTS "salaryAfterConfirmation" DOUBLE PRECISION;

-- Step 8: Create candidate_reference_checks table
CREATE TABLE IF NOT EXISTS jobs.candidate_reference_checks (
  id                  TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "candidateId"       TEXT        NOT NULL,
  "reference1ReportUrl" TEXT,
  "reference2ReportUrl" TEXT,
  notes               TEXT,
  "checkedBy"         TEXT        NOT NULL,
  "checkedAt"         TIMESTAMP   NOT NULL DEFAULT now(),
  "createdAt"         TIMESTAMP   NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMP   NOT NULL DEFAULT now(),

  CONSTRAINT candidate_reference_checks_pkey PRIMARY KEY (id),
  CONSTRAINT candidate_reference_checks_candidateId_key UNIQUE ("candidateId"),
  CONSTRAINT candidate_reference_checks_candidate_fk
    FOREIGN KEY ("candidateId") REFERENCES jobs.candidates(id) ON DELETE CASCADE
);
