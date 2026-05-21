-- Add per-stamp device serial number tracking to attendance_records
-- Enables audit of which physical device recorded each clock-in/out

ALTER TABLE attendance.attendance_records
  ADD COLUMN IF NOT EXISTS "clockInDeviceSN"  TEXT,
  ADD COLUMN IF NOT EXISTS "clockOutDeviceSN" TEXT;
