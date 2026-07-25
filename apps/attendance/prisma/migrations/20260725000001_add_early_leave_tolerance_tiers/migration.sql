ALTER TABLE attendance."DeductionPolicy"
  ADD COLUMN IF NOT EXISTS "earlyLeaveToleranceMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "earlyLeaveDeductionTiers"   TEXT;
