CREATE TABLE clinic_physio.physio_follow_ups (
  id                    TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "caseId"              TEXT        NOT NULL,
  "followUpNumber"      INTEGER,
  "sessionDate"         TIMESTAMPTZ NOT NULL,
  "sessionTime"         TEXT,
  modalities            TEXT[]      NOT NULL DEFAULT '{}',
  notes                 TEXT,
  "supervisorOpinion"   TEXT,
  "doctorDecision"      TEXT,
  "physiotherapistId"   TEXT,
  "painLevel"           INTEGER,
  "romMeasurements"     JSONB,
  "attendanceConfirmed" BOOLEAN     NOT NULL DEFAULT false,
  "appointmentId"       TEXT,

  CONSTRAINT physio_follow_ups_pkey PRIMARY KEY (id),
  CONSTRAINT physio_follow_ups_caseId_fkey FOREIGN KEY ("caseId")
    REFERENCES clinic_physio.physio_cases(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX physio_follow_ups_caseId_idx ON clinic_physio.physio_follow_ups ("caseId");
CREATE INDEX physio_follow_ups_sessionDate_idx ON clinic_physio.physio_follow_ups ("sessionDate");
