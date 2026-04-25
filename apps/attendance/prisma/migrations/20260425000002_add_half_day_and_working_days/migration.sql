-- AddColumn: halfDayPeriod on attendance_records (nullable — no default needed)
ALTER TABLE attendance.attendance_records
  ADD COLUMN IF NOT EXISTS "halfDayPeriod" TEXT;

-- AddColumn: workingDaysInMonth on monthly_payrolls (default 0)
ALTER TABLE attendance.monthly_payrolls
  ADD COLUMN IF NOT EXISTS "workingDaysInMonth" INTEGER NOT NULL DEFAULT 0;
