CREATE TABLE clinic_prosthetics.case_treatment_programs (
  "id"                    TEXT         NOT NULL,
  "caseId"                TEXT         NOT NULL,
  "sessionDate"           TIMESTAMP(3),
  "sessionTime"           TEXT,
  "sessionStartTime"      TEXT,
  "sessionEndTime"        TEXT,
  "description"           TEXT,
  "technicianId"          TEXT,
  "technicianSignatureUrl" TEXT,
  "managerSignatureUrl"   TEXT,
  "notes"                 TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "case_treatment_programs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "case_treatment_programs_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES clinic_prosthetics.prosthetics_cases("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "case_treatment_programs_caseId_idx" ON clinic_prosthetics.case_treatment_programs("caseId");
