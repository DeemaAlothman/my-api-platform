-- Add dailyWage to employees
ALTER TABLE users.employees
  ADD COLUMN IF NOT EXISTS "dailyWage" DECIMAL(15,2);

-- Create salary_advances table
CREATE TABLE IF NOT EXISTS users.salary_advances (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "employeeId"        UUID NOT NULL REFERENCES users.employees(id),
  "totalAmount"       DECIMAL(15,2) NOT NULL,
  "installmentAmount" DECIMAL(15,2) NOT NULL,
  "remainingBalance"  DECIMAL(15,2) NOT NULL,
  "totalInstallments" INTEGER NOT NULL,
  "paidInstallments"  INTEGER NOT NULL DEFAULT 0,
  "startYear"         INTEGER NOT NULL,
  "startMonth"        INTEGER NOT NULL,
  status              TEXT NOT NULL DEFAULT 'ACTIVE',
  reason              TEXT,
  notes               TEXT,
  "createdBy"         TEXT NOT NULL,
  "cancelledBy"       TEXT,
  "cancelledAt"       TIMESTAMPTZ,
  "cancelReason"      TEXT,
  "deletedAt"         TIMESTAMPTZ,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "salary_advances_employeeId_idx" ON users.salary_advances ("employeeId");
CREATE INDEX IF NOT EXISTS "salary_advances_status_idx" ON users.salary_advances (status);
CREATE INDEX IF NOT EXISTS "salary_advances_startYear_startMonth_idx" ON users.salary_advances ("startYear", "startMonth");

-- Create salary_advance_installments table
CREATE TABLE IF NOT EXISTS users.salary_advance_installments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "advanceId" UUID NOT NULL REFERENCES users.salary_advances(id),
  year        INTEGER NOT NULL,
  month       INTEGER NOT NULL,
  amount      DECIMAL(15,2) NOT NULL,
  "payrollId" TEXT,
  "deductedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("advanceId", year, month)
);

CREATE INDEX IF NOT EXISTS "salary_advance_installments_advanceId_idx" ON users.salary_advance_installments ("advanceId");
CREATE INDEX IF NOT EXISTS "salary_advance_installments_year_month_idx" ON users.salary_advance_installments (year, month);

-- Create sales_commissions table
CREATE TABLE IF NOT EXISTS users.sales_commissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "employeeId"     UUID NOT NULL REFERENCES users.employees(id),
  year             INTEGER NOT NULL,
  month            INTEGER NOT NULL,
  amount           DECIMAL(15,2) NOT NULL,
  description      TEXT NOT NULL,
  "salesReference" TEXT,
  status           TEXT NOT NULL DEFAULT 'DRAFT',
  "createdBy"      TEXT NOT NULL,
  "approvedBy"     TEXT,
  "approvedAt"     TIMESTAMPTZ,
  "deletedAt"      TIMESTAMPTZ,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("employeeId", year, month, "salesReference")
);

CREATE INDEX IF NOT EXISTS "sales_commissions_employeeId_idx" ON users.sales_commissions ("employeeId");
CREATE INDEX IF NOT EXISTS "sales_commissions_year_month_idx" ON users.sales_commissions (year, month);
CREATE INDEX IF NOT EXISTS "sales_commissions_status_idx" ON users.sales_commissions (status);
