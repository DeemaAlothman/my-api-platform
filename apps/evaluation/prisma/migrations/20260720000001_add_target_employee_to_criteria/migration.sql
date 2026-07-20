ALTER TABLE evaluation.probation_criteria
  ADD COLUMN IF NOT EXISTS "targetEmployeeId" TEXT;
