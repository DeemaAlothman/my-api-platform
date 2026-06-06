-- Create employee_history_events table (employee dossier timeline: transfers, salary changes, promotions)
CREATE TABLE IF NOT EXISTS users.employee_history_events (
  id              TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "employeeId"    TEXT        NOT NULL,
  "eventType"     TEXT        NOT NULL,
  "fromValue"     JSONB,
  "toValue"       JSONB,
  note            TEXT,
  "effectiveDate" TIMESTAMPTZ NOT NULL,
  "performedBy"   TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT employee_history_events_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS employee_history_events_employeeId_idx
  ON users.employee_history_events ("employeeId");
