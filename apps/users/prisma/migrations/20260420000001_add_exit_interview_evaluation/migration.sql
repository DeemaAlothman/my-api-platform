-- Add exitInterviewEvaluation field to employees (nullable, no default, no impact on existing rows)
ALTER TABLE users.employees ADD COLUMN IF NOT EXISTS "exitInterviewEvaluation" TEXT;
