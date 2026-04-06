-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "jobs";

-- CreateEnum
CREATE TYPE "jobs"."WorkType" AS ENUM ('FULL_TIME', 'PART_TIME');

-- CreateEnum
CREATE TYPE "jobs"."WorkMode" AS ENUM ('ON_SITE', 'REMOTE', 'HYBRID');

-- CreateEnum
CREATE TYPE "jobs"."PositionStatus" AS ENUM ('OPEN', 'CLOSED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "jobs"."EvaluationDecision" AS ENUM ('ACCEPTED', 'REFERRED_TO_OTHER', 'DEFERRED', 'REJECTED');

-- CreateTable
CREATE TABLE "jobs"."InterviewPosition" (
    "id" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "sectorName" TEXT,
    "workType" "jobs"."WorkType" NOT NULL DEFAULT 'FULL_TIME',
    "workMode" "jobs"."WorkMode" NOT NULL DEFAULT 'ON_SITE',
    "committeeMembers" JSONB NOT NULL DEFAULT '[]',
    "interviewDate" TIMESTAMP(3),
    "status" "jobs"."PositionStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "InterviewPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs"."PersonalCriterion" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "description" TEXT,
    "maxScore" INTEGER NOT NULL DEFAULT 5,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs"."ComputerCriterion" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "description" TEXT,
    "maxScore" INTEGER NOT NULL DEFAULT 5,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComputerCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs"."TechnicalQuestion" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "maxScore" INTEGER NOT NULL DEFAULT 10,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TechnicalQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs"."InterviewEvaluation" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "jobApplicationId" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "residence" TEXT,
    "dateOfBirth" DATE,
    "maritalStatus" TEXT,
    "contactNumber" TEXT,
    "academicDegree" TEXT,
    "yearsOfExperience" DOUBLE PRECISION,
    "expectedSalary" DOUBLE PRECISION,
    "expectedJoinDate" DATE,
    "generalNotes" TEXT,
    "personalScore" DOUBLE PRECISION,
    "technicalScore" DOUBLE PRECISION,
    "computerScore" DOUBLE PRECISION,
    "totalScore" DOUBLE PRECISION,
    "decision" "jobs"."EvaluationDecision",
    "proposedSalary" DOUBLE PRECISION,
    "evaluatorId" TEXT,
    "evaluatedAt" TIMESTAMP(3),
    "isTransferred" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs"."PersonalCriteriaScore" (
    "evaluationId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,

    CONSTRAINT "PersonalCriteriaScore_pkey" PRIMARY KEY ("evaluationId","criterionId")
);

-- CreateTable
CREATE TABLE "jobs"."TechnicalQuestionScore" (
    "evaluationId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,

    CONSTRAINT "TechnicalQuestionScore_pkey" PRIMARY KEY ("evaluationId","questionId")
);

-- CreateTable
CREATE TABLE "jobs"."ComputerCriteriaScore" (
    "evaluationId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,

    CONSTRAINT "ComputerCriteriaScore_pkey" PRIMARY KEY ("evaluationId","criterionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "InterviewEvaluation_jobApplicationId_key" ON "jobs"."InterviewEvaluation"("jobApplicationId");

-- AddForeignKey
ALTER TABLE "jobs"."TechnicalQuestion" ADD CONSTRAINT "TechnicalQuestion_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "jobs"."InterviewPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs"."InterviewEvaluation" ADD CONSTRAINT "InterviewEvaluation_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "jobs"."InterviewPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs"."PersonalCriteriaScore" ADD CONSTRAINT "PersonalCriteriaScore_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "jobs"."InterviewEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs"."PersonalCriteriaScore" ADD CONSTRAINT "PersonalCriteriaScore_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "jobs"."PersonalCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs"."TechnicalQuestionScore" ADD CONSTRAINT "TechnicalQuestionScore_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "jobs"."InterviewEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs"."TechnicalQuestionScore" ADD CONSTRAINT "TechnicalQuestionScore_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "jobs"."TechnicalQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs"."ComputerCriteriaScore" ADD CONSTRAINT "ComputerCriteriaScore_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "jobs"."InterviewEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs"."ComputerCriteriaScore" ADD CONSTRAINT "ComputerCriteriaScore_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "jobs"."ComputerCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
