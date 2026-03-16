-- ============================================================
-- Migration: Approval system, new request types, leave attachment
-- ============================================================
-- NOTE: Run PART 1 first (outside transaction), then PART 2

-- ============================================================
-- PART 1: ALTER TYPE ADD VALUE (run separately, outside transaction)
-- ============================================================
SET search_path TO requests;

ALTER TYPE "RequestType" ADD VALUE IF NOT EXISTS 'PENALTY_PROPOSAL';
ALTER TYPE "RequestType" ADD VALUE IF NOT EXISTS 'OVERTIME_EMPLOYEE';
ALTER TYPE "RequestType" ADD VALUE IF NOT EXISTS 'OVERTIME_MANAGER';
ALTER TYPE "RequestType" ADD VALUE IF NOT EXISTS 'BUSINESS_MISSION';
ALTER TYPE "RequestType" ADD VALUE IF NOT EXISTS 'DELEGATION';
ALTER TYPE "RequestType" ADD VALUE IF NOT EXISTS 'HIRING_REQUEST';
ALTER TYPE "RequestType" ADD VALUE IF NOT EXISTS 'COMPLAINT';

ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'IN_APPROVAL';

-- ============================================================
-- PART 2: Run inside transaction
-- ============================================================
BEGIN;
SET search_path TO requests;

-- 1. ApproverRole enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid
                 WHERE t.typname = 'ApproverRole' AND n.nspname = 'requests') THEN
    CREATE TYPE "ApproverRole" AS ENUM ('DIRECT_MANAGER','DEPARTMENT_MANAGER','TARGET_MANAGER','HR','CEO','CFO');
  END IF;
END $$;

-- 2. New columns on requests
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS "currentStepOrder" INTEGER,
  ADD COLUMN IF NOT EXISTS "targetEmployeeId"  TEXT;

-- 3. approval_workflows table
CREATE TABLE IF NOT EXISTS approval_workflows (
  "id"          TEXT    NOT NULL,
  "requestType" "RequestType" NOT NULL,
  "stepOrder"   INTEGER NOT NULL,
  "approverRole" "ApproverRole" NOT NULL,
  "isRequired"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "approval_workflows_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "approval_workflows_requestType_stepOrder_key" UNIQUE ("requestType", "stepOrder")
);

-- 4. approval_steps table
CREATE TABLE IF NOT EXISTS approval_steps (
  "id"           TEXT    NOT NULL,
  "requestId"    TEXT    NOT NULL,
  "stepOrder"    INTEGER NOT NULL,
  "approverRole" "ApproverRole" NOT NULL,
  "status"       "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedBy"   TEXT,
  "reviewedAt"   TIMESTAMP(3),
  "notes"        TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "approval_steps_requestId_stepOrder_key" UNIQUE ("requestId", "stepOrder")
);
CREATE INDEX IF NOT EXISTS "approval_steps_requestId_idx" ON approval_steps("requestId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approval_steps_requestId_fkey') THEN
    ALTER TABLE approval_steps ADD CONSTRAINT "approval_steps_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES requests("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 5. Seed approval_workflows
INSERT INTO approval_workflows (id, "requestType", "stepOrder", "approverRole") VALUES
  -- RESIGNATION (3 steps)
  (gen_random_uuid()::text, 'RESIGNATION',       1, 'DIRECT_MANAGER'),
  (gen_random_uuid()::text, 'RESIGNATION',       2, 'HR'),
  (gen_random_uuid()::text, 'RESIGNATION',       3, 'CEO'),
  -- TRANSFER (4 steps)
  (gen_random_uuid()::text, 'TRANSFER',          1, 'DIRECT_MANAGER'),
  (gen_random_uuid()::text, 'TRANSFER',          2, 'TARGET_MANAGER'),
  (gen_random_uuid()::text, 'TRANSFER',          3, 'HR'),
  (gen_random_uuid()::text, 'TRANSFER',          4, 'CEO'),
  -- PENALTY_PROPOSAL (3 steps)
  (gen_random_uuid()::text, 'PENALTY_PROPOSAL',  1, 'DIRECT_MANAGER'),
  (gen_random_uuid()::text, 'PENALTY_PROPOSAL',  2, 'HR'),
  (gen_random_uuid()::text, 'PENALTY_PROPOSAL',  3, 'CEO'),
  -- REWARD (4 steps)
  (gen_random_uuid()::text, 'REWARD',            1, 'DIRECT_MANAGER'),
  (gen_random_uuid()::text, 'REWARD',            2, 'HR'),
  (gen_random_uuid()::text, 'REWARD',            3, 'CEO'),
  (gen_random_uuid()::text, 'REWARD',            4, 'CFO'),
  -- OVERTIME_EMPLOYEE (1 step)
  (gen_random_uuid()::text, 'OVERTIME_EMPLOYEE', 1, 'DIRECT_MANAGER'),
  -- OVERTIME_MANAGER (1 step)
  (gen_random_uuid()::text, 'OVERTIME_MANAGER',  1, 'DIRECT_MANAGER'),
  -- BUSINESS_MISSION (3 steps)
  (gen_random_uuid()::text, 'BUSINESS_MISSION',  1, 'DIRECT_MANAGER'),
  (gen_random_uuid()::text, 'BUSINESS_MISSION',  2, 'HR'),
  (gen_random_uuid()::text, 'BUSINESS_MISSION',  3, 'CEO'),
  -- DELEGATION (1 step)
  (gen_random_uuid()::text, 'DELEGATION',        1, 'DIRECT_MANAGER'),
  -- HIRING_REQUEST (3 steps)
  (gen_random_uuid()::text, 'HIRING_REQUEST',    1, 'DIRECT_MANAGER'),
  (gen_random_uuid()::text, 'HIRING_REQUEST',    2, 'HR'),
  (gen_random_uuid()::text, 'HIRING_REQUEST',    3, 'CEO'),
  -- COMPLAINT (1 step)
  (gen_random_uuid()::text, 'COMPLAINT',         1, 'HR'),
  -- ADVANCE (2 steps)
  (gen_random_uuid()::text, 'ADVANCE',           1, 'DIRECT_MANAGER'),
  (gen_random_uuid()::text, 'ADVANCE',           2, 'HR'),
  -- PERMISSION (1 step)
  (gen_random_uuid()::text, 'PERMISSION',        1, 'DIRECT_MANAGER'),
  -- JOB_CHANGE (2 steps)
  (gen_random_uuid()::text, 'JOB_CHANGE',        1, 'DIRECT_MANAGER'),
  (gen_random_uuid()::text, 'JOB_CHANGE',        2, 'HR'),
  -- RIGHTS (2 steps)
  (gen_random_uuid()::text, 'RIGHTS',            1, 'DIRECT_MANAGER'),
  (gen_random_uuid()::text, 'RIGHTS',            2, 'HR'),
  -- SPONSORSHIP (2 steps)
  (gen_random_uuid()::text, 'SPONSORSHIP',       1, 'DIRECT_MANAGER'),
  (gen_random_uuid()::text, 'SPONSORSHIP',       2, 'HR'),
  -- OTHER (2 steps)
  (gen_random_uuid()::text, 'OTHER',             1, 'DIRECT_MANAGER'),
  (gen_random_uuid()::text, 'OTHER',             2, 'HR')
ON CONFLICT DO NOTHING;

COMMIT;
