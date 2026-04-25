-- WorkSchedule: add business rules fields
ALTER TABLE "attendance"."work_schedules"
  ADD COLUMN IF NOT EXISTS "minimumWorkMinutes"     INTEGER,
  ADD COLUMN IF NOT EXISTS "requiresContinuousWork" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "holidayMultiplier"      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "shiftType"              TEXT NOT NULL DEFAULT 'DAY';

-- DeductionPolicy: add monthly tolerance + food exclusion + versioning
ALTER TABLE "attendance"."deduction_policies"
  ADD COLUMN IF NOT EXISTS "monthlyLateToleranceMinutes" INTEGER NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS "excludedAllowanceTypes"      JSONB   NOT NULL DEFAULT '["FOOD"]',
  ADD COLUMN IF NOT EXISTS "effectiveFrom"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "deduction_policies_effectiveFrom_idx"
  ON "attendance"."deduction_policies"("effectiveFrom");

-- AttendanceRecord: add computation & hourly leave fields
ALTER TABLE "attendance"."attendance_records"
  ADD COLUMN IF NOT EXISTS "lateCompensatedMinutes"       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "longestContinuousWorkMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "punchSequenceStatus"          TEXT    NOT NULL DEFAULT 'VALID',
  ADD COLUMN IF NOT EXISTS "leaveStartTime"               TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "leaveEndTime"                 TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "hourlyLeaveMinutes"           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "computationVersion"           INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "recomputedAt"                 TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "attendance_records_emp_date_punch_idx"
  ON "attendance"."attendance_records"("employeeId", "date", "punchSequenceStatus");

-- AttendanceComputationLog: add before/after snapshots
ALTER TABLE "attendance"."attendance_computation_logs"
  ADD COLUMN IF NOT EXISTS "beforeSnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "afterSnapshot"  JSONB,
  ADD COLUMN IF NOT EXISTS "computedBy"     TEXT;

-- MonthlyPayroll: add deductible base + pro-rating + breakdown fields
ALTER TABLE "attendance"."monthly_payrolls"
  ADD COLUMN IF NOT EXISTS "deductibleBaseSalary"      DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "excludedAllowancesAmount"  DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "deductionBreakdown"        JSONB,
  ADD COLUMN IF NOT EXISTS "totalLateMinutesGross"     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalLateMinutesEffective" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalCompensationMinutes"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "employeeWorkingDays"       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "proRationFactor"           DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS "appliedPolicySnapshot"     JSONB;
