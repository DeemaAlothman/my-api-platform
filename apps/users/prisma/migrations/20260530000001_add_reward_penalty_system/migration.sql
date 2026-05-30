-- Add PENALTY_DECISION and REWARD_DECISION to NotificationType enum
ALTER TYPE users."NotificationType" ADD VALUE IF NOT EXISTS 'PENALTY_DECISION';
ALTER TYPE users."NotificationType" ADD VALUE IF NOT EXISTS 'REWARD_DECISION';

-- Create employee_rewards_penalties table (records finalised material/moral decisions)
CREATE TABLE IF NOT EXISTS users.employee_rewards_penalties (
  id              TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "employeeId"    TEXT        NOT NULL,
  kind            TEXT        NOT NULL,
  category        TEXT        NOT NULL,
  "penaltyDays"   FLOAT,
  amount          NUMERIC(15, 2),
  "typeCode"      TEXT,
  reason          TEXT,
  recommendation  TEXT,
  "requestId"     TEXT,
  "issuedBy"      TEXT,
  status          TEXT        NOT NULL DEFAULT 'ACTIVE',
  "effectiveDate" TIMESTAMPTZ NOT NULL,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT employee_rewards_penalties_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS employee_rewards_penalties_employeeId_idx
  ON users.employee_rewards_penalties ("employeeId");
