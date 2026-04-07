-- Migration: إضافة الحقول المالية لجدول monthly_payrolls
-- تاريخ: 2026-04-07

ALTER TABLE attendance.monthly_payrolls
  ADD COLUMN IF NOT EXISTS "basicSalary"            DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "allowancesTotal"         DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "allowancesBreakdown"     TEXT,
  ADD COLUMN IF NOT EXISTS "overtimePay"             DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "deductionAmount"         DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "absenceDeductionAmount"  DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "grossSalary"             DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "netSalary"               DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "currency"                TEXT DEFAULT 'SYP',
  ADD COLUMN IF NOT EXISTS "dailyRate"               DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "minuteRate"              DECIMAL(15,4),
  ADD COLUMN IF NOT EXISTS "overtimeRateMultiplier"  DECIMAL(5,2) DEFAULT 1.5;
