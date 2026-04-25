-- LeaveBalance: add hourly tracking fields
ALTER TABLE "leaves"."leave_balances"
  ADD COLUMN IF NOT EXISTS "usedHours"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pendingHours" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- LeaveRequest: add hourly leave fields
ALTER TABLE "leaves"."leave_requests"
  ADD COLUMN IF NOT EXISTS "isHourlyLeave"  BOOLEAN          NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "startTime"      TEXT,
  ADD COLUMN IF NOT EXISTS "endTime"        TEXT,
  ADD COLUMN IF NOT EXISTS "durationHours"  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "equivalentDays" DOUBLE PRECISION;
