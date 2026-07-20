CREATE SCHEMA IF NOT EXISTS clinic_podiatry;

CREATE TABLE IF NOT EXISTS clinic_podiatry.podiatry_receptions (
  "id"                  TEXT NOT NULL PRIMARY KEY,
  "patientId"           TEXT NOT NULL,
  "height"              DOUBLE PRECISION,
  "weight"              DOUBLE PRECISION,
  "occupation"          TEXT,
  "activities"          TEXT,
  "problemDescription"  TEXT,
  "historyOfSymptoms"   TEXT,
  "affectedSide"        TEXT[] NOT NULL DEFAULT '{}',
  "footSymptoms"        TEXT[] NOT NULL DEFAULT '{}',
  "visitTypes"          TEXT[] NOT NULL DEFAULT '{}',
  "medicalHistory"      TEXT[] NOT NULL DEFAULT '{}',
  "medicalHistoryOther" TEXT,
  "vasScore"            INTEGER,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy"           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clinic_podiatry.podiatry_sessions (
  "id"                  TEXT NOT NULL PRIMARY KEY,
  "receptionId"         TEXT NOT NULL,
  "patientId"           TEXT NOT NULL,
  "sessionDate"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "clinicalPlan"        TEXT[] NOT NULL DEFAULT '{}',
  "rightFlatFoot"       BOOLEAN NOT NULL DEFAULT false,
  "rightHighArch"       BOOLEAN NOT NULL DEFAULT false,
  "rightPronation"      BOOLEAN NOT NULL DEFAULT false,
  "rightSupination"     BOOLEAN NOT NULL DEFAULT false,
  "rightPressureNotes"  TEXT,
  "rightAsymmetry"      TEXT,
  "leftFlatFoot"        BOOLEAN NOT NULL DEFAULT false,
  "leftHighArch"        BOOLEAN NOT NULL DEFAULT false,
  "leftPronation"       BOOLEAN NOT NULL DEFAULT false,
  "leftSupination"      BOOLEAN NOT NULL DEFAULT false,
  "leftPressureNotes"   TEXT,
  "leftAsymmetry"       TEXT,
  "clinicianName"       TEXT,
  "clinicianSignature"  TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy"           TEXT NOT NULL,
  CONSTRAINT "podiatry_sessions_receptionId_fkey"
    FOREIGN KEY ("receptionId") REFERENCES clinic_podiatry.podiatry_receptions("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "podiatry_receptions_patientId_idx" ON clinic_podiatry.podiatry_receptions("patientId");
CREATE INDEX IF NOT EXISTS "podiatry_sessions_receptionId_idx" ON clinic_podiatry.podiatry_sessions("receptionId");
CREATE INDEX IF NOT EXISTS "podiatry_sessions_patientId_idx"   ON clinic_podiatry.podiatry_sessions("patientId");
