SET search_path TO clinic_podiatry;

CREATE TABLE IF NOT EXISTS podiatry_reviews (
  id            TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "receptionId" TEXT        NOT NULL UNIQUE,
  notes         TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdBy"   TEXT        NOT NULL,
  "updatedBy"   TEXT,
  CONSTRAINT fk_review_reception FOREIGN KEY ("receptionId") REFERENCES podiatry_receptions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS podiatry_doctor_decisions (
  id            TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "receptionId" TEXT        NOT NULL UNIQUE,
  decision      TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdBy"   TEXT        NOT NULL,
  "updatedBy"   TEXT,
  CONSTRAINT fk_doctor_decision_reception FOREIGN KEY ("receptionId") REFERENCES podiatry_receptions(id) ON DELETE CASCADE
);
