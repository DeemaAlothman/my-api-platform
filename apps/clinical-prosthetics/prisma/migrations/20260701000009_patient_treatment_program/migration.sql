CREATE TABLE clinic_prosthetics.patient_treatment_programs (
  "id"                     TEXT NOT NULL,
  "workshopSessionId"      TEXT,
  "ptSessionId"            TEXT,
  "mediaSessionId"         TEXT,
  "description"            TEXT,
  "sessionStartTime"       TEXT,
  "sessionEndTime"         TEXT,
  "technicianId"           TEXT,
  "technicianSignatureUrl" TEXT,
  "managerSignatureUrl"    TEXT,
  "notes"                  TEXT,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patient_treatment_programs_pkey"              PRIMARY KEY ("id"),
  CONSTRAINT "patient_treatment_programs_workshopSessionId_key" UNIQUE ("workshopSessionId"),
  CONSTRAINT "patient_treatment_programs_ptSessionId_key"       UNIQUE ("ptSessionId"),
  CONSTRAINT "patient_treatment_programs_mediaSessionId_key"    UNIQUE ("mediaSessionId"),
  CONSTRAINT "patient_treatment_programs_workshopSessionId_fkey"
    FOREIGN KEY ("workshopSessionId") REFERENCES clinic_prosthetics.workshop_sessions("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "patient_treatment_programs_ptSessionId_fkey"
    FOREIGN KEY ("ptSessionId") REFERENCES clinic_prosthetics.pt_sessions("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "patient_treatment_programs_mediaSessionId_fkey"
    FOREIGN KEY ("mediaSessionId") REFERENCES clinic_prosthetics.media_sessions("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
