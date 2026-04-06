-- Add Probation evaluation tables to evaluation schema
SET search_path TO evaluation;

-- CreateEnum: ProbationStatus
DO $$ BEGIN
  CREATE TYPE "ProbationStatus" AS ENUM (
    'DRAFT','PENDING_SENIOR_MANAGER','PENDING_HR','PENDING_CEO',
    'PENDING_EMPLOYEE_ACKNOWLEDGMENT','COMPLETED',
    'REJECTED_BY_SENIOR','REJECTED_BY_HR','REJECTED_BY_CEO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum: ProbationRecommendation
DO $$ BEGIN
  CREATE TYPE "ProbationRecommendation" AS ENUM (
    'EXTEND_PROBATION','CONFIRM_POSITION','TRANSFER_POSITION','TERMINATE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum: ProbationRating
DO $$ BEGIN
  CREATE TYPE "ProbationRating" AS ENUM (
    'UNACCEPTABLE','ACCEPTABLE','GOOD','VERY_GOOD','EXCELLENT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: ProbationCriteria
CREATE TABLE IF NOT EXISTS "ProbationCriteria" (
    "id"           TEXT NOT NULL,
    "nameAr"       TEXT NOT NULL,
    "nameEn"       TEXT,
    "isCore"       BOOLEAN NOT NULL DEFAULT false,
    "isActive"     BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProbationCriteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable: JobTitleCriteria
CREATE TABLE IF NOT EXISTS "JobTitleCriteria" (
    "jobTitleId"   TEXT NOT NULL,
    "criteriaId"   TEXT NOT NULL,
    "isEnabled"    BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER,

    CONSTRAINT "JobTitleCriteria_pkey" PRIMARY KEY ("jobTitleId","criteriaId")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'JobTitleCriteria_criteriaId_fkey') THEN
    ALTER TABLE "JobTitleCriteria" ADD CONSTRAINT "JobTitleCriteria_criteriaId_fkey"
      FOREIGN KEY ("criteriaId") REFERENCES "ProbationCriteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable: ProbationEvaluation
CREATE TABLE IF NOT EXISTS "ProbationEvaluation" (
    "id"                       TEXT NOT NULL,
    "employeeId"               TEXT NOT NULL,
    "hireDate"                 DATE NOT NULL,
    "probationEndDate"         DATE NOT NULL,
    "evaluationDate"           DATE,
    "evaluatorId"              TEXT NOT NULL,
    "evaluatorNotes"           TEXT,
    "isDelegated"              BOOLEAN NOT NULL DEFAULT false,
    "delegationNote"           TEXT,
    "seniorManagerId"          TEXT,
    "seniorManagerNotes"       TEXT,
    "hrManagerId"              TEXT,
    "hrManagerNotes"           TEXT,
    "ceoId"                    TEXT,
    "ceoRecommendations"       TEXT,
    "finalRecommendation"      "ProbationRecommendation",
    "workAreasNote"            TEXT,
    "status"                   "ProbationStatus" NOT NULL DEFAULT 'DRAFT',
    "employeeAcknowledgedAt"   TIMESTAMP(3),
    "employeeAcknowledged"     BOOLEAN NOT NULL DEFAULT false,
    "employeeNotes"            TEXT,
    "overallRating"            "ProbationRating",
    "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProbationEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProbationCriteriaScore
CREATE TABLE IF NOT EXISTS "ProbationCriteriaScore" (
    "evaluationId" TEXT NOT NULL,
    "criteriaId"   TEXT NOT NULL,
    "score"        "ProbationRating" NOT NULL,

    CONSTRAINT "ProbationCriteriaScore_pkey" PRIMARY KEY ("evaluationId","criteriaId")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProbationCriteriaScore_evaluationId_fkey') THEN
    ALTER TABLE "ProbationCriteriaScore" ADD CONSTRAINT "ProbationCriteriaScore_evaluationId_fkey"
      FOREIGN KEY ("evaluationId") REFERENCES "ProbationEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProbationCriteriaScore_criteriaId_fkey') THEN
    ALTER TABLE "ProbationCriteriaScore" ADD CONSTRAINT "ProbationCriteriaScore_criteriaId_fkey"
      FOREIGN KEY ("criteriaId") REFERENCES "ProbationCriteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable: ProbationEvaluationHistory
CREATE TABLE IF NOT EXISTS "ProbationEvaluationHistory" (
    "id"           TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "action"       TEXT NOT NULL,
    "performedBy"  TEXT NOT NULL,
    "notes"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProbationEvaluationHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProbationEvaluationHistory_evaluationId_idx" ON "ProbationEvaluationHistory"("evaluationId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProbationEvaluationHistory_evaluationId_fkey') THEN
    ALTER TABLE "ProbationEvaluationHistory" ADD CONSTRAINT "ProbationEvaluationHistory_evaluationId_fkey"
      FOREIGN KEY ("evaluationId") REFERENCES "ProbationEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
