-- Add ProbationResult enum and probation result fields to employees

SET search_path TO users;

DO $$ BEGIN
  CREATE TYPE "ProbationResult" AS ENUM (
    'CONFIRM_POSITION',
    'EXTEND_PROBATION',
    'TRANSFER_POSITION',
    'TERMINATE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS "probationResult"      "ProbationResult",
  ADD COLUMN IF NOT EXISTS "probationCompletedAt" TIMESTAMP(3);
