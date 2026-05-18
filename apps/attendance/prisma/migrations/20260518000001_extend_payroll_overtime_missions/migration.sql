-- Add overtime split columns to attendance_records
ALTER TABLE attendance.attendance_records
  ADD COLUMN IF NOT EXISTS "overtimeWorkdayMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "overtimeHolidayMinutes" INTEGER NOT NULL DEFAULT 0;

-- Backfill: distribute existing overtimeMinutes based on day status
UPDATE attendance.attendance_records
SET
  "overtimeWorkdayMinutes" = CASE
    WHEN status IN ('WEEKEND', 'HOLIDAY') THEN 0
    ELSE COALESCE("overtimeMinutes", 0)
  END,
  "overtimeHolidayMinutes" = CASE
    WHEN status IN ('WEEKEND', 'HOLIDAY') THEN COALESCE("overtimeMinutes", 0)
    ELSE 0
  END
WHERE
  "overtimeMinutes" IS NOT NULL
  AND "overtimeMinutes" > 0
  AND "overtimeWorkdayMinutes" = 0
  AND "overtimeHolidayMinutes" = 0;

-- Add new fields to deduction_policies
ALTER TABLE attendance.deduction_policies
  ADD COLUMN IF NOT EXISTS "holidayOvertimeMultiplier" DECIMAL(5,2) NOT NULL DEFAULT 2.0,
  ADD COLUMN IF NOT EXISTS "internalMissionDailyRate"  DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "externalMissionDailyRate"  DECIMAL(15,2) NOT NULL DEFAULT 0;

-- Add new fields to monthly_payrolls
ALTER TABLE attendance.monthly_payrolls
  ADD COLUMN IF NOT EXISTS "hourlyRate"               DECIMAL(15,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "dailyWageSnapshot"        DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "paidLeaveDays"            FLOAT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "unpaidLeaveDays"          FLOAT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "unpaidLeaveAmount"        DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "sickLeaveDays"            FLOAT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "hourlyLeaveMinutes"       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "hourlyLeaveAmount"        DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "overtimeWorkdayMinutes"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "overtimeWorkdayPay"       DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "overtimeHolidayMinutes"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "overtimeHolidayPay"       DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "internalMissionDays"      FLOAT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "internalMissionAmount"    DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "externalMissionDays"      FLOAT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "externalMissionAmount"    DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "commissionAmount"         DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "advanceDeduction"         DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "otherDeductionAmount"     DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "otherDeductionNotes"      TEXT,
  ADD COLUMN IF NOT EXISTS "roundedNetSalary"         INTEGER,
  ADD COLUMN IF NOT EXISTS "employmentStatusAtGenTime" TEXT;

-- Change default currency to USD for new payrolls (existing rows keep their value)
ALTER TABLE attendance.monthly_payrolls
  ALTER COLUMN currency SET DEFAULT 'USD';
