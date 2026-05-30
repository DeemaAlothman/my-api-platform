-- Add overtimeRequestId (link to approved overtime request) and breakOverLimitMinutes
-- to attendance_records. Both are purely additive with safe defaults.

ALTER TABLE attendance.attendance_records
  ADD COLUMN IF NOT EXISTS "overtimeRequestId"     TEXT,
  ADD COLUMN IF NOT EXISTS "breakOverLimitMinutes" INTEGER NOT NULL DEFAULT 0;
