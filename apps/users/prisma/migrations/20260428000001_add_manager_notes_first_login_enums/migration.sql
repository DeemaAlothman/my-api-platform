-- Phase 2: Add firstLoginAt to users, manager notes to employees, new NotificationType values

SET search_path TO users;

-- A.1.1: Add firstLoginAt to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS "firstLoginAt" TIMESTAMP(3);

-- A.1.2: Add manager notes fields to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "managerNotes"          TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "managerNotesUpdatedAt" TIMESTAMP(3);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "managerNotesUpdatedBy" TEXT;

-- A.1.3: Add new NotificationType enum values
-- Recreate the enum to safely add values (works in all PostgreSQL versions)
CREATE TYPE "NotificationType_new" AS ENUM (
  'LEAVE_REQUEST_SUBMITTED',
  'LEAVE_REQUEST_APPROVED',
  'LEAVE_REQUEST_REJECTED',
  'LEAVE_REQUEST_CANCELLED',
  'ATTENDANCE_ALERT',
  'ATTENDANCE_JUSTIFICATION',
  'EVALUATION_ASSIGNED',
  'EVALUATION_SUBMITTED',
  'PROBATION_REMINDER',
  'ONBOARDING_TASK',
  'OFFBOARDING_TASK',
  'DOCUMENT_EXPIRY',
  'GENERAL',
  'CONTRACT_EXPIRY',
  'PROBATION_END_REMINDER',
  'BIRTHDAY',
  'WELCOME',
  'EMPLOYEES_WITHOUT_SCHEDULE'
);

ALTER TABLE notifications
  ALTER COLUMN type TYPE "NotificationType_new"
  USING type::text::"NotificationType_new";

DROP TYPE "NotificationType";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
