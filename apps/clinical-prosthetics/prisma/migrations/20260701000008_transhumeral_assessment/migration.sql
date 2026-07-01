CREATE TABLE clinic_prosthetics.transhumeral_assessments (
  "id"                     TEXT NOT NULL,
  "caseId"                 TEXT NOT NULL,
  "side"                   "clinic_prosthetics"."AssessmentSide" NOT NULL,
  "notes"                  TEXT,
  "soundLimb"              JSONB,
  "affectedLimb"           JSONB,
  "examinerProsthetistIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "examinerPhysioIds"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "examinerSupervisorIds"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "examinedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transhumeral_assessments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transhumeral_assessments_caseId_side_key" UNIQUE ("caseId", "side"),
  CONSTRAINT "transhumeral_assessments_caseId_fkey"
    FOREIGN KEY ("caseId")
    REFERENCES clinic_prosthetics.prosthetics_cases("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
