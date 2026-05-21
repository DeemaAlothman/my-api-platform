-- Extend monthly_payrolls with tardiness and hourly leave breakdown columns
-- These enable transparent reporting of how tardiness was handled in each month

ALTER TABLE attendance.monthly_payrolls
  ADD COLUMN IF NOT EXISTS "paidHourlyLeaveMinutes"          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "unpaidHourlyLeaveMinutes"        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tardinessOffsetMinutes"          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tardinessJustifiedMinutes"       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tardinessCompensatedMinutes"     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tardinessUncompensatedMinutes"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tardinessDeductionAmount"        DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "hourlyBalanceUsedTotal"          FLOAT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "hourlyBalanceRemaining"          FLOAT NOT NULL DEFAULT 0;
