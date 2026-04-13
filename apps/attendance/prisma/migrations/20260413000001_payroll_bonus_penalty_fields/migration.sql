-- Add bonus/penalty fields to monthly_payrolls
ALTER TABLE attendance.monthly_payrolls
  ADD COLUMN IF NOT EXISTS "bonusAmount"   DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "penaltyAmount" DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "bonusDetails"  TEXT,
  ADD COLUMN IF NOT EXISTS "penaltyDetails" TEXT;
