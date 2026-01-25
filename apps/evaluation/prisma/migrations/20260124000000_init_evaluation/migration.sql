-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "evaluation";

-- CreateEnum
CREATE TYPE "evaluation"."PeriodStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "evaluation"."CriteriaCategory" AS ENUM ('PERFORMANCE', 'BEHAVIOR', 'SKILLS', 'ACHIEVEMENT', 'DEVELOPMENT');

-- CreateEnum
CREATE TYPE "evaluation"."FormStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "evaluation"."EvaluationStatus" AS ENUM ('PENDING_SELF', 'SELF_SUBMITTED', 'PENDING_MANAGER', 'MANAGER_SUBMITTED', 'PENDING_HR_REVIEW', 'HR_REVIEWED', 'PENDING_GM_APPROVAL', 'COMPLETED');

-- CreateEnum
CREATE TYPE "evaluation"."HRRecommendation" AS ENUM ('PROMOTION', 'SALARY_INCREASE', 'BONUS', 'TRAINING', 'WARNING', 'TERMINATION', 'NO_ACTION');

-- CreateEnum
CREATE TYPE "evaluation"."ApprovalStatus" AS ENUM ('APPROVED', 'REJECTED', 'NEEDS_REVISION');

-- CreateEnum
CREATE TYPE "evaluation"."FinalRating" AS ENUM ('EXCELLENT', 'VERY_GOOD', 'GOOD', 'SATISFACTORY', 'NEEDS_IMPROVEMENT');

-- CreateEnum
CREATE TYPE "evaluation"."PeerRating" AS ENUM ('EXCELLENT', 'VERY_GOOD', 'GOOD', 'SATISFACTORY', 'NEEDS_IMPROVEMENT');

-- CreateEnum
CREATE TYPE "evaluation"."GoalStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "evaluation"."EvaluationPeriod" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "evaluation"."PeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation"."EvaluationCriteria" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "descriptionAr" TEXT,
    "descriptionEn" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "maxScore" INTEGER NOT NULL DEFAULT 5,
    "category" "evaluation"."CriteriaCategory" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationCriteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation"."EvaluationForm" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "evaluatorId" TEXT,
    "selfStatus" "evaluation"."FormStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "selfScore" DOUBLE PRECISION,
    "selfSubmittedAt" TIMESTAMP(3),
    "selfComments" TEXT,
    "managerStatus" "evaluation"."FormStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "managerScore" DOUBLE PRECISION,
    "managerSubmittedAt" TIMESTAMP(3),
    "managerComments" TEXT,
    "managerStrengths" TEXT,
    "managerWeaknesses" TEXT,
    "managerRecommendations" TEXT,
    "hrReviewedBy" TEXT,
    "hrReviewedAt" TIMESTAMP(3),
    "hrComments" TEXT,
    "hrRecommendation" "evaluation"."HRRecommendation",
    "gmApprovedBy" TEXT,
    "gmApprovedAt" TIMESTAMP(3),
    "gmStatus" "evaluation"."ApprovalStatus",
    "gmComments" TEXT,
    "finalScore" DOUBLE PRECISION,
    "finalRating" "evaluation"."FinalRating",
    "status" "evaluation"."EvaluationStatus" NOT NULL DEFAULT 'PENDING_SELF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation"."EvaluationSection" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "criteriaId" TEXT NOT NULL,
    "selfScore" INTEGER,
    "selfComments" TEXT,
    "managerScore" INTEGER,
    "managerComments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation"."PeerEvaluation" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "peerId" TEXT NOT NULL,
    "rating" "evaluation"."PeerRating" NOT NULL,
    "strengths" TEXT,
    "improvements" TEXT,
    "comments" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT true,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeerEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation"."EmployeeGoal" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetDate" DATE,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "selfAchievement" DOUBLE PRECISION,
    "selfComments" TEXT,
    "managerAchievement" DOUBLE PRECISION,
    "managerComments" TEXT,
    "status" "evaluation"."GoalStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation"."EvaluationHistory" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "details" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationPeriod_code_key" ON "evaluation"."EvaluationPeriod"("code");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationCriteria_code_key" ON "evaluation"."EvaluationCriteria"("code");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationForm_periodId_employeeId_key" ON "evaluation"."EvaluationForm"("periodId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationSection_formId_criteriaId_key" ON "evaluation"."EvaluationSection"("formId", "criteriaId");

-- CreateIndex
CREATE UNIQUE INDEX "PeerEvaluation_formId_peerId_key" ON "evaluation"."PeerEvaluation"("formId", "peerId");

-- CreateIndex
CREATE INDEX "EvaluationHistory_formId_idx" ON "evaluation"."EvaluationHistory"("formId");

-- AddForeignKey
ALTER TABLE "evaluation"."EvaluationForm" ADD CONSTRAINT "EvaluationForm_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "evaluation"."EvaluationPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation"."EvaluationSection" ADD CONSTRAINT "EvaluationSection_formId_fkey" FOREIGN KEY ("formId") REFERENCES "evaluation"."EvaluationForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation"."EvaluationSection" ADD CONSTRAINT "EvaluationSection_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "evaluation"."EvaluationCriteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation"."PeerEvaluation" ADD CONSTRAINT "PeerEvaluation_formId_fkey" FOREIGN KEY ("formId") REFERENCES "evaluation"."EvaluationForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation"."EmployeeGoal" ADD CONSTRAINT "EmployeeGoal_formId_fkey" FOREIGN KEY ("formId") REFERENCES "evaluation"."EvaluationForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
