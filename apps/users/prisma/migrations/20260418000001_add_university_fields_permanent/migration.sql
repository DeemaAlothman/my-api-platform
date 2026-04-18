-- Add university name fields for 1st and 2nd degree
ALTER TABLE users.employees
  ADD COLUMN IF NOT EXISTS "university1" TEXT,
  ADD COLUMN IF NOT EXISTS "university2" TEXT;

-- Add PERMANENT to ProbationPeriod enum (only if enum already exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE t.typname = 'ProbationPeriod' AND n.nspname = 'users') THEN
    ALTER TYPE users."ProbationPeriod" ADD VALUE IF NOT EXISTS 'PERMANENT';
  END IF;
END $$;
