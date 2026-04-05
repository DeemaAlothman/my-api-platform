-- Create jobs schema
CREATE SCHEMA IF NOT EXISTS "jobs";

SET search_path TO "jobs";

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "jobs"."WorkType" AS ENUM ('FULL_TIME', 'PART_TIME');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "jobs"."WorkMode" AS ENUM ('ON_SITE', 'REMOTE', 'HYBRID');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "jobs"."PositionStatus" AS ENUM ('OPEN', 'CLOSED', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "jobs"."EvaluationDecision" AS ENUM ('ACCEPTED', 'REFERRED_TO_OTHER', 'DEFERRED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable InterviewPosition
CREATE TABLE IF NOT EXISTS "jobs"."InterviewPosition" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "InterviewPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable PersonalCriterion
CREATE TABLE IF NOT EXISTS "jobs"."PersonalCriterion" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "description" TEXT,
    "maxScore" INTEGER NOT NULL DEFAULT 5,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PersonalCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable ComputerCriterion
CREATE TABLE IF NOT EXISTS "jobs"."ComputerCriterion" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "description" TEXT,
    "maxScore" INTEGER NOT NULL DEFAULT 5,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComputerCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable TechnicalQuestion
CREATE TABLE IF NOT EXISTS "jobs"."TechnicalQuestion" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "maxScore" INTEGER NOT NULL DEFAULT 10,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "TechnicalQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable InterviewEvaluation
CREATE TABLE IF NOT EXISTS "jobs"."InterviewEvaluation" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InterviewEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable PersonalCriteriaScore
CREATE TABLE IF NOT EXISTS "jobs"."PersonalCriteriaScore" (
    "evaluationId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    CONSTRAINT "PersonalCriteriaScore_pkey" PRIMARY KEY ("evaluationId","criterionId")
);

-- CreateTable TechnicalQuestionScore
CREATE TABLE IF NOT EXISTS "jobs"."TechnicalQuestionScore" (
    "evaluationId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    CONSTRAINT "TechnicalQuestionScore_pkey" PRIMARY KEY ("evaluationId","questionId")
);

-- CreateTable ComputerCriteriaScore
CREATE TABLE IF NOT EXISTS "jobs"."ComputerCriteriaScore" (
    "evaluationId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    CONSTRAINT "ComputerCriteriaScore_pkey" PRIMARY KEY ("evaluationId","criterionId")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InterviewEvaluation_jobApplicationId_key" ON "jobs"."InterviewEvaluation"("jobApplicationId");

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "jobs"."TechnicalQuestion" ADD CONSTRAINT "TechnicalQuestion_positionId_fkey"
    FOREIGN KEY ("positionId") REFERENCES "jobs"."InterviewPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "jobs"."InterviewEvaluation" ADD CONSTRAINT "InterviewEvaluation_positionId_fkey"
    FOREIGN KEY ("positionId") REFERENCES "jobs"."InterviewPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "jobs"."PersonalCriteriaScore" ADD CONSTRAINT "PersonalCriteriaScore_evaluationId_fkey"
    FOREIGN KEY ("evaluationId") REFERENCES "jobs"."InterviewEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "jobs"."PersonalCriteriaScore" ADD CONSTRAINT "PersonalCriteriaScore_criterionId_fkey"
    FOREIGN KEY ("criterionId") REFERENCES "jobs"."PersonalCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "jobs"."TechnicalQuestionScore" ADD CONSTRAINT "TechnicalQuestionScore_evaluationId_fkey"
    FOREIGN KEY ("evaluationId") REFERENCES "jobs"."InterviewEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "jobs"."TechnicalQuestionScore" ADD CONSTRAINT "TechnicalQuestionScore_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "jobs"."TechnicalQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "jobs"."ComputerCriteriaScore" ADD CONSTRAINT "ComputerCriteriaScore_evaluationId_fkey"
    FOREIGN KEY ("evaluationId") REFERENCES "jobs"."InterviewEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "jobs"."ComputerCriteriaScore" ADD CONSTRAINT "ComputerCriteriaScore_criterionId_fkey"
    FOREIGN KEY ("criterionId") REFERENCES "jobs"."ComputerCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed initial criteria
INSERT INTO "jobs"."PersonalCriterion" ("id","nameAr","maxScore","displayOrder","updatedAt") VALUES
  ('personal-1','المظهر العام والهندام',5,1,CURRENT_TIMESTAMP),
  ('personal-2','الثقة بالنفس والحضور',5,2,CURRENT_TIMESTAMP),
  ('personal-3','مهارات التواصل والتعبير',5,3,CURRENT_TIMESTAMP),
  ('personal-4','القدرة على الإقناع',5,4,CURRENT_TIMESTAMP),
  ('personal-5','التفكير المنطقي وحل المشكلات',5,5,CURRENT_TIMESTAMP),
  ('personal-6','الذكاء العاطفي والتعامل مع الضغوط',5,6,CURRENT_TIMESTAMP),
  ('personal-7','روح الفريق والتعاون',5,7,CURRENT_TIMESTAMP),
  ('personal-8','المبادرة والاستباقية',5,8,CURRENT_TIMESTAMP),
  ('personal-9','الطموح والرغبة في التطور',5,9,CURRENT_TIMESTAMP),
  ('personal-10','الالتزام والمسؤولية',5,10,CURRENT_TIMESTAMP),
  ('personal-11','مرونة التكيف مع التغيير',5,11,CURRENT_TIMESTAMP),
  ('personal-12','مهارات التفاوض',5,12,CURRENT_TIMESTAMP),
  ('personal-13','القيادة والتأثير',5,13,CURRENT_TIMESTAMP),
  ('personal-14','الانتماء والولاء المؤسسي',5,14,CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "jobs"."ComputerCriterion" ("id","nameAr","maxScore","displayOrder","updatedAt") VALUES
  ('computer-1','مهارات Office (Word/Excel/PowerPoint)',5,1,CURRENT_TIMESTAMP),
  ('computer-2','التعامل مع الأنظمة الإلكترونية والبريد',5,2,CURRENT_TIMESTAMP),
  ('computer-3','مهارات البحث والتوثيق الرقمي',5,3,CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
