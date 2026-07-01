CREATE TABLE clinic_prosthetics.patient_review_programs (
  "id"               TEXT         NOT NULL,
  "caseId"           TEXT         NOT NULL,
  "sessionDate"      TIMESTAMP(3),
  "sessionTime"      TEXT,
  "description"      TEXT,
  "technicianId"     TEXT,
  "sessionStartTime" TEXT,
  "sessionEndTime"   TEXT,
  "signatureUrl"     TEXT,
  "notes"            TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patient_review_programs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "patient_review_programs_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES clinic_prosthetics.prosthetics_cases("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "patient_review_programs_caseId_idx" ON clinic_prosthetics.patient_review_programs("caseId");
