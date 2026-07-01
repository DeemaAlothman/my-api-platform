CREATE TABLE clinic_prosthetics.ankle_disarticulation_assessments (
  "id"                     TEXT NOT NULL,
  "caseId"                 TEXT NOT NULL,
  "side"                   "clinic_prosthetics"."AssessmentSide" NOT NULL,
  "notes"                  TEXT,
  "footMeasurement"        TEXT,
  "soundLimb"              JSONB,
  "affectedLimb"           JSONB,
  "examinerProsthetistIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "examinerPhysioIds"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "examinerSupervisorIds"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "examinedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ankle_disarticulation_assessments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ankle_disarticulation_assessments_caseId_side_key" UNIQUE ("caseId", "side"),
  CONSTRAINT "ankle_disarticulation_assessments_caseId_fkey"
    FOREIGN KEY ("caseId")
    REFERENCES clinic_prosthetics.prosthetics_cases("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
