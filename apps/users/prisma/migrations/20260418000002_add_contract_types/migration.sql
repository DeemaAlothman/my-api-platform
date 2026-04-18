-- Fix ContractType enum: rebuild with correct values and add CONSULTANT/SERVICE_PROVIDER
SET search_path TO users;

-- Rebuild enum cleanly (handles broken state from old migration)
ALTER TABLE employees ALTER COLUMN "contractType" TYPE TEXT;

DROP TYPE IF EXISTS "ContractType";
CREATE TYPE "ContractType" AS ENUM (
  'FIXED_TERM', 'INDEFINITE', 'TEMPORARY', 'TRAINEE',
  'CONSULTANT', 'SERVICE_PROVIDER'
);

-- Map legacy values from original schema
UPDATE employees SET "contractType" = 'INDEFINITE' WHERE "contractType" = 'PERMANENT';
UPDATE employees SET "contractType" = 'FIXED_TERM'  WHERE "contractType" = 'CONTRACT';
UPDATE employees SET "contractType" = 'TRAINEE'     WHERE "contractType" = 'INTERNSHIP';
-- Default any remaining unknown values to FIXED_TERM
UPDATE employees SET "contractType" = 'FIXED_TERM'
  WHERE "contractType" NOT IN ('FIXED_TERM','INDEFINITE','TEMPORARY','TRAINEE','CONSULTANT','SERVICE_PROVIDER');

ALTER TABLE employees
  ALTER COLUMN "contractType" TYPE "ContractType"
  USING "contractType"::"ContractType";
