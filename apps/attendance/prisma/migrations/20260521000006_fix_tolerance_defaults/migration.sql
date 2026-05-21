-- Fix 0.5.10: change default tolerance from 15 to 0
-- Existing records are untouched; only new work_schedules get 0 by default
ALTER TABLE "attendance"."work_schedules"
  ALTER COLUMN "lateToleranceMin" SET DEFAULT 0;

ALTER TABLE "attendance"."work_schedules"
  ALTER COLUMN "earlyLeaveToleranceMin" SET DEFAULT 0;
