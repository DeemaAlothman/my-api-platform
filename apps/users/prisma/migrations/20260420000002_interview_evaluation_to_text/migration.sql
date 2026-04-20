-- Convert interviewEvaluation from enum to TEXT (preserves existing values as strings)
ALTER TABLE users.employees
  ALTER COLUMN "interviewEvaluation" TYPE TEXT
  USING "interviewEvaluation"::TEXT;
