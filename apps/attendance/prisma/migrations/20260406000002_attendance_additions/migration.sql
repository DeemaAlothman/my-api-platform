-- Add missing columns to attendance_records
SET search_path TO attendance;

ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS "source"            TEXT NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "deviceSN"          TEXT,
  ADD COLUMN IF NOT EXISTS "totalBreakMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "netWorkedMinutes"  INTEGER,
  ADD COLUMN IF NOT EXISTS "salaryLinked"      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "deductionApplied"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "deductionMinutes"  INTEGER;

-- CreateTable: attendance_breaks
CREATE TABLE IF NOT EXISTS attendance_breaks (
    "id"                 TEXT NOT NULL,
    "attendanceRecordId" TEXT NOT NULL,
    "breakOut"           TIMESTAMP(3) NOT NULL,
    "breakIn"            TIMESTAMP(3),
    "durationMinutes"    INTEGER,
    "reason"             TEXT,
    "isAuthorized"       BOOLEAN NOT NULL DEFAULT false,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_breaks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "attendance_breaks_attendanceRecordId_idx" ON attendance_breaks("attendanceRecordId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_breaks_attendanceRecordId_fkey') THEN
    ALTER TABLE attendance_breaks ADD CONSTRAINT "attendance_breaks_attendanceRecordId_fkey"
      FOREIGN KEY ("attendanceRecordId") REFERENCES attendance_records("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable: attendance_justifications
CREATE TABLE IF NOT EXISTS attendance_justifications (
    "id"                 TEXT NOT NULL,
    "employeeId"         TEXT NOT NULL,
    "alertId"            TEXT NOT NULL,
    "attendanceRecordId" TEXT,
    "justificationType"  TEXT NOT NULL,
    "descriptionAr"      TEXT NOT NULL,
    "descriptionEn"      TEXT,
    "attachmentUrl"      TEXT,
    "deadline"           TIMESTAMP(3) NOT NULL,
    "status"             TEXT NOT NULL DEFAULT 'PENDING_MANAGER',
    "managerReviewedBy"  TEXT,
    "managerReviewedAt"  TIMESTAMP(3),
    "managerNotes"       TEXT,
    "managerNotesAr"     TEXT,
    "hrReviewedBy"       TEXT,
    "hrReviewedAt"       TIMESTAMP(3),
    "hrNotes"            TEXT,
    "hrNotesAr"          TEXT,
    "deductionApplied"   BOOLEAN NOT NULL DEFAULT false,
    "deductionMinutes"   INTEGER,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_justifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "attendance_justifications_alertId_key" ON attendance_justifications("alertId");
CREATE INDEX IF NOT EXISTS "attendance_justifications_employeeId_idx" ON attendance_justifications("employeeId");
CREATE INDEX IF NOT EXISTS "attendance_justifications_status_idx" ON attendance_justifications("status");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_justifications_alertId_fkey') THEN
    ALTER TABLE attendance_justifications ADD CONSTRAINT "attendance_justifications_alertId_fkey"
      FOREIGN KEY ("alertId") REFERENCES attendance_alerts("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable: employee_attendance_configs
CREATE TABLE IF NOT EXISTS employee_attendance_configs (
    "id"                   TEXT NOT NULL,
    "employeeId"           TEXT NOT NULL,
    "salaryLinked"         BOOLEAN NOT NULL DEFAULT true,
    "allowedBreakMinutes"  INTEGER NOT NULL DEFAULT 60,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_attendance_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "employee_attendance_configs_employeeId_key" ON employee_attendance_configs("employeeId");

-- CreateTable: deduction_policies
CREATE TABLE IF NOT EXISTS deduction_policies (
    "id"                      TEXT NOT NULL,
    "nameAr"                  TEXT NOT NULL,
    "nameEn"                  TEXT,
    "isDefault"               BOOLEAN NOT NULL DEFAULT false,
    "lateToleranceMinutes"    INTEGER NOT NULL DEFAULT 15,
    "lateDeductionType"       TEXT NOT NULL DEFAULT 'MINUTE_BY_MINUTE',
    "lateDeductionTiers"      TEXT,
    "earlyLeaveDeductionType" TEXT NOT NULL DEFAULT 'MINUTE_BY_MINUTE',
    "absenceDeductionDays"    DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "repeatLateThreshold"     INTEGER,
    "repeatLatePenaltyDays"   DOUBLE PRECISION,
    "breakOverLimitDeduction" TEXT NOT NULL DEFAULT 'MINUTE_BY_MINUTE',
    "isActive"                BOOLEAN NOT NULL DEFAULT true,
    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deduction_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable: monthly_payrolls
CREATE TABLE IF NOT EXISTS monthly_payrolls (
    "id"                           TEXT NOT NULL,
    "employeeId"                   TEXT NOT NULL,
    "year"                         INTEGER NOT NULL,
    "month"                        INTEGER NOT NULL,
    "workingDays"                  INTEGER NOT NULL,
    "presentDays"                  INTEGER NOT NULL,
    "absentDays"                   INTEGER NOT NULL,
    "absentUnjustified"            INTEGER NOT NULL,
    "lateDays"                     INTEGER NOT NULL,
    "totalLateMinutes"             INTEGER NOT NULL,
    "earlyLeaveDays"               INTEGER NOT NULL,
    "totalEarlyLeaveMinutes"       INTEGER NOT NULL,
    "breakOverLimitMinutes"        INTEGER NOT NULL,
    "overtimeMinutes"              INTEGER NOT NULL,
    "totalWorkedMinutes"           INTEGER NOT NULL,
    "netWorkedMinutes"             INTEGER NOT NULL,
    "lateDeductionMinutes"         INTEGER NOT NULL DEFAULT 0,
    "earlyLeaveDeductionMinutes"   INTEGER NOT NULL DEFAULT 0,
    "breakDeductionMinutes"        INTEGER NOT NULL DEFAULT 0,
    "absenceDeductionDays"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "repeatLatePenaltyDays"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeductionMinutes"        INTEGER NOT NULL DEFAULT 0,
    "salaryLinked"                 BOOLEAN NOT NULL DEFAULT true,
    "policyId"                     TEXT,
    "status"                       TEXT NOT NULL DEFAULT 'DRAFT',
    "notes"                        TEXT,
    "generatedAt"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedBy"                  TEXT,
    "confirmedAt"                  TIMESTAMP(3),
    "createdAt"                    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_payrolls_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "monthly_payrolls_employeeId_year_month_key" ON monthly_payrolls("employeeId", "year", "month");
CREATE INDEX IF NOT EXISTS "monthly_payrolls_year_month_idx" ON monthly_payrolls("year", "month");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monthly_payrolls_policyId_fkey') THEN
    ALTER TABLE monthly_payrolls ADD CONSTRAINT "monthly_payrolls_policyId_fkey"
      FOREIGN KEY ("policyId") REFERENCES deduction_policies("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
