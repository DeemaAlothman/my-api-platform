-- Add tardiness tracking columns to attendance_records
-- tardinessOffsetMinutes: minutes covered from hourly leave balance
-- tardinessPendingDeductionMinutes: minutes to deduct from salary (balance exceeded)

ALTER TABLE attendance.attendance_records
  ADD COLUMN IF NOT EXISTS "tardinessOffsetMinutes"           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tardinessPendingDeductionMinutes" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "attendance_records_tardiness_pending_idx"
  ON attendance.attendance_records("tardinessPendingDeductionMinutes")
  WHERE "tardinessPendingDeductionMinutes" > 0;
