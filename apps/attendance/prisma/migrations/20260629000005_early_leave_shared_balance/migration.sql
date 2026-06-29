ALTER TABLE attendance.attendance_records
  ADD COLUMN IF NOT EXISTS "earlyLeaveCompensatedMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "earlyLeaveOffsetMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "earlyLeavePendingDeductionMinutes" INTEGER NOT NULL DEFAULT 0;
