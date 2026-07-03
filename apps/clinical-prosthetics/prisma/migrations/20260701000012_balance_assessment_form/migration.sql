CREATE TABLE clinic_prosthetics.balance_assessment_forms (
  "id"                          TEXT         NOT NULL,
  "caseId"                      TEXT         NOT NULL,
  "assessmentDate"              TIMESTAMP(3),
  "previousProsthesis"          BOOLEAN,
  "assistiveDevice"             TEXT,
  "staticBalance"               JSONB,
  "dynamicTasks"                JSONB,
  "dynamicActivities"           JSONB,
  "historyOfFalls"              BOOLEAN,
  "nearFalls"                   BOOLEAN,
  "fearOfFalling"               BOOLEAN,
  "fallRiskLevel"               TEXT,
  "overallBalanceLevel"         TEXT,
  "limitingFactors"             TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "exerciseProgram"             JSONB,
  "programProgression"          TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "followUpWeeks"               INTEGER,
  "expectedOutcomes"            TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "physiotherapistId"           TEXT,
  "physiotherapistSignatureUrl" TEXT,
  "committeeHeadId"             TEXT,
  "committeeHeadSignatureUrl"   TEXT,
  "followUpDate"                TIMESTAMP(3),
  "notes"                       TEXT,
  "createdAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "balance_assessment_forms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "balance_assessment_forms_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES clinic_prosthetics.prosthetics_cases("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "balance_assessment_forms_caseId_idx" ON clinic_prosthetics.balance_assessment_forms("caseId");
