-- Add Probation Enums (idempotent)
DO $$ BEGIN
  CREATE TYPE "evaluation"."ProbationStatus" AS ENUM ('DRAFT', 'PENDING_SENIOR_MANAGER', 'PENDING_HR', 'PENDING_CEO', 'PENDING_EMPLOYEE_ACKNOWLEDGMENT', 'COMPLETED', 'REJECTED_BY_SENIOR', 'REJECTED_BY_HR', 'REJECTED_BY_CEO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "evaluation"."ProbationRecommendation" AS ENUM ('EXTEND_PROBATION', 'CONFIRM_POSITION', 'TRANSFER_POSITION', 'TERMINATE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "evaluation"."ProbationRating" AS ENUM ('UNACCEPTABLE', 'ACCEPTABLE', 'GOOD', 'VERY_GOOD', 'EXCELLENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable ProbationCriteria
CREATE TABLE IF NOT EXISTS "evaluation"."ProbationCriteria" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "isCore" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProbationCriteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable JobTitleCriteria
CREATE TABLE IF NOT EXISTS "evaluation"."JobTitleCriteria" (
    "jobTitleId" TEXT NOT NULL,
    "criteriaId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER,
    CONSTRAINT "JobTitleCriteria_pkey" PRIMARY KEY ("jobTitleId","criteriaId")
);

-- CreateTable ProbationEvaluation
CREATE TABLE IF NOT EXISTS "evaluation"."ProbationEvaluation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "hireDate" DATE NOT NULL,
    "probationEndDate" DATE NOT NULL,
    "evaluationDate" DATE,
    "evaluatorId" TEXT NOT NULL,
    "evaluatorNotes" TEXT,
    "isDelegated" BOOLEAN NOT NULL DEFAULT false,
    "delegationNote" TEXT,
    "seniorManagerId" TEXT,
    "seniorManagerNotes" TEXT,
    "hrManagerId" TEXT,
    "hrManagerNotes" TEXT,
    "ceoId" TEXT,
    "ceoRecommendations" TEXT,
    "finalRecommendation" "evaluation"."ProbationRecommendation",
    "workAreasNote" TEXT,
    "status" "evaluation"."ProbationStatus" NOT NULL DEFAULT 'DRAFT',
    "employeeAcknowledgedAt" TIMESTAMP(3),
    "employeeAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "employeeNotes" TEXT,
    "overallRating" "evaluation"."ProbationRating",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProbationEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable ProbationCriteriaScore
CREATE TABLE IF NOT EXISTS "evaluation"."ProbationCriteriaScore" (
    "evaluationId" TEXT NOT NULL,
    "criteriaId" TEXT NOT NULL,
    "score" "evaluation"."ProbationRating" NOT NULL,
    CONSTRAINT "ProbationCriteriaScore_pkey" PRIMARY KEY ("evaluationId","criteriaId")
);

-- CreateTable ProbationEvaluationHistory
CREATE TABLE IF NOT EXISTS "evaluation"."ProbationEvaluationHistory" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProbationEvaluationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProbationEvaluationHistory_evaluationId_idx" ON "evaluation"."ProbationEvaluationHistory"("evaluationId");

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "evaluation"."JobTitleCriteria" ADD CONSTRAINT "JobTitleCriteria_criteriaId_fkey"
    FOREIGN KEY ("criteriaId") REFERENCES "evaluation"."ProbationCriteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "evaluation"."ProbationCriteriaScore" ADD CONSTRAINT "ProbationCriteriaScore_evaluationId_fkey"
    FOREIGN KEY ("evaluationId") REFERENCES "evaluation"."ProbationEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "evaluation"."ProbationCriteriaScore" ADD CONSTRAINT "ProbationCriteriaScore_criteriaId_fkey"
    FOREIGN KEY ("criteriaId") REFERENCES "evaluation"."ProbationCriteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "evaluation"."ProbationEvaluationHistory" ADD CONSTRAINT "ProbationEvaluationHistory_evaluationId_fkey"
    FOREIGN KEY ("evaluationId") REFERENCES "evaluation"."ProbationEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
