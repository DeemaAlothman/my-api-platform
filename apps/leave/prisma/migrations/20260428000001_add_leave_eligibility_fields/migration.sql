-- Add eligibility and deduction fields to leave_types
ALTER TABLE "leaves"."leave_types"
  ADD COLUMN IF NOT EXISTS "minServiceMonths"     INTEGER,
  ADD COLUMN IF NOT EXISTS "maxLifetimeUsage"     INTEGER,
  ADD COLUMN IF NOT EXISTS "salaryDeductionRules" JSONB,
  ADD COLUMN IF NOT EXISTS "maxHoursPerMonth"     DOUBLE PRECISION;

-- Add deduction tracking field to leave_requests
ALTER TABLE "leaves"."leave_requests"
  ADD COLUMN IF NOT EXISTS "deductionInfo" JSONB;

-- Update leave types with 2026 HR policies
UPDATE "leaves"."leave_types" SET
  "defaultDays" = 14, "maxDaysPerRequest" = 30
WHERE code = 'ANNUAL';

UPDATE "leaves"."leave_types" SET
  "defaultDays" = 180,
  "maxDaysPerRequest" = 180,
  "salaryDeductionRules" = '[{"fromDay":1,"toDay":90,"deductionPercent":30},{"fromDay":91,"toDay":180,"deductionPercent":20}]'::jsonb
WHERE code = 'SICK';

UPDATE "leaves"."leave_types" SET
  "defaultDays" = 120, "maxDaysPerRequest" = 120
WHERE code = 'MATERNITY';

UPDATE "leaves"."leave_types" SET
  "defaultDays" = 5, "maxDaysPerRequest" = 5
WHERE code = 'BEREAVEMENT';

UPDATE "leaves"."leave_types" SET
  "defaultDays" = 7, "maxDaysPerRequest" = 7, "minServiceMonths" = 6
WHERE code = 'MARRIAGE';

UPDATE "leaves"."leave_types" SET
  "defaultDays" = 30, "maxDaysPerRequest" = 30, "minServiceMonths" = 60, "maxLifetimeUsage" = 1
WHERE code = 'HAJJ';

UPDATE "leaves"."leave_types" SET
  "minServiceMonths" = 12
WHERE code = 'STUDY';

UPDATE "leaves"."leave_types" SET
  "maxDaysPerRequest" = NULL
WHERE code = 'UNPAID';

-- Recalculate 2026 balances based on updated defaultDays
UPDATE "leaves"."leave_balances" lb
SET "totalDays" = 14,
    "remainingDays" = GREATEST(0, 14 - lb."usedDays" - lb."pendingDays")
FROM "leaves"."leave_types" lt
WHERE lb."leaveTypeId" = lt.id AND lt.code = 'ANNUAL' AND lb.year = 2026;

UPDATE "leaves"."leave_balances" lb
SET "totalDays" = 180,
    "remainingDays" = GREATEST(0, 180 - lb."usedDays" - lb."pendingDays")
FROM "leaves"."leave_types" lt
WHERE lb."leaveTypeId" = lt.id AND lt.code = 'SICK' AND lb.year = 2026;

UPDATE "leaves"."leave_balances" lb
SET "totalDays" = 120,
    "remainingDays" = GREATEST(0, 120 - lb."usedDays" - lb."pendingDays")
FROM "leaves"."leave_types" lt
WHERE lb."leaveTypeId" = lt.id AND lt.code = 'MATERNITY' AND lb.year = 2026;

UPDATE "leaves"."leave_balances" lb
SET "totalDays" = 5,
    "remainingDays" = GREATEST(0, 5 - lb."usedDays" - lb."pendingDays")
FROM "leaves"."leave_types" lt
WHERE lb."leaveTypeId" = lt.id AND lt.code = 'BEREAVEMENT' AND lb.year = 2026;

UPDATE "leaves"."leave_balances" lb
SET "totalDays" = 7,
    "remainingDays" = GREATEST(0, 7 - lb."usedDays" - lb."pendingDays")
FROM "leaves"."leave_types" lt
WHERE lb."leaveTypeId" = lt.id AND lt.code = 'MARRIAGE' AND lb.year = 2026;

UPDATE "leaves"."leave_balances" lb
SET "totalDays" = 30,
    "remainingDays" = GREATEST(0, 30 - lb."usedDays" - lb."pendingDays")
FROM "leaves"."leave_types" lt
WHERE lb."leaveTypeId" = lt.id AND lt.code = 'HAJJ' AND lb.year = 2026;
