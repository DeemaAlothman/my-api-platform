-- Add missing enums and columns that exist in schema but were never migrated
SET search_path TO users;

-- Enums
DO $$ BEGIN
  CREATE TYPE "EducationLevel" AS ENUM (
    'PRIMARY', 'INTERMEDIATE', 'SECONDARY', 'DIPLOMA', 'BACHELOR', 'POSTGRADUATE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BloodType" AS ENUM (
    'A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE',
    'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProbationPeriod" AS ENUM (
    'ONE_MONTH', 'TWO_MONTHS', 'THREE_MONTHS', 'PERMANENT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add PERMANENT if enum already existed without it
ALTER TYPE "ProbationPeriod" ADD VALUE IF NOT EXISTS 'PERMANENT';

DO $$ BEGIN
  CREATE TYPE "InterviewEvaluation" AS ENUM (
    'EXCELLENT', 'VERY_GOOD', 'GOOD', 'ACCEPTABLE', 'POOR'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Columns on employees
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS "profilePhoto"       TEXT,
  ADD COLUMN IF NOT EXISTS "bloodType"          "BloodType",
  ADD COLUMN IF NOT EXISTS "familyMembersCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "chronicDiseases"    TEXT,
  ADD COLUMN IF NOT EXISTS "currentAddress"     TEXT,
  ADD COLUMN IF NOT EXISTS "isSmoker"           BOOLEAN,
  ADD COLUMN IF NOT EXISTS "educationLevel"     "EducationLevel",
  ADD COLUMN IF NOT EXISTS "universityYear"     INTEGER,
  ADD COLUMN IF NOT EXISTS "religion"           TEXT,
  ADD COLUMN IF NOT EXISTS "probationPeriod"    "ProbationPeriod",
  ADD COLUMN IF NOT EXISTS "interviewEvaluation" "InterviewEvaluation";
