-- Remove unused request types: PERMISSION, ADVANCE, JOB_CHANGE, RIGHTS, SPONSORSHIP

SET search_path TO requests;

-- Delete approval workflows for removed types
DELETE FROM approval_workflows WHERE "requestType" IN ('PERMISSION','ADVANCE','JOB_CHANGE','RIGHTS','SPONSORSHIP');

-- Delete any existing requests with removed types (soft delete)
UPDATE requests SET "deletedAt" = NOW() WHERE type IN ('PERMISSION','ADVANCE','JOB_CHANGE','RIGHTS','SPONSORSHIP') AND "deletedAt" IS NULL;

-- Recreate the enum without removed values
CREATE TYPE "RequestType_new" AS ENUM (
  'TRANSFER',
  'RESIGNATION',
  'REWARD',
  'OTHER',
  'PENALTY_PROPOSAL',
  'OVERTIME_EMPLOYEE',
  'OVERTIME_MANAGER',
  'BUSINESS_MISSION',
  'DELEGATION',
  'HIRING_REQUEST',
  'COMPLAINT'
);

ALTER TABLE requests
  ALTER COLUMN type TYPE "RequestType_new"
  USING type::text::"RequestType_new";

ALTER TABLE approval_workflows
  ALTER COLUMN "requestType" TYPE "RequestType_new"
  USING "requestType"::text::"RequestType_new";

DROP TYPE "RequestType";
ALTER TYPE "RequestType_new" RENAME TO "RequestType";
