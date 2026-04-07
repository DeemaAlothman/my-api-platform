-- Migration: Sprint 5 — Candidate Pipeline
-- إضافة نظام إدارة المتقدمين وعروض العمل

-- Enums
DO $$ BEGIN CREATE TYPE jobs."CandidateStage" AS ENUM ('NEW','INITIAL_REVIEW','PHONE_INTERVIEW','TECHNICAL_INTERVIEW','FINAL_INTERVIEW','OFFER_SENT','HIRED','REJECTED','WITHDRAWN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE jobs."CandidateSource" AS ENUM ('WEBSITE','LINKEDIN','INTERNAL_REFERRAL','RECRUITMENT_AGENCY','WALK_IN','OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE jobs."OfferStatus" AS ENUM ('DRAFT','SENT','ACCEPTED','REJECTED','EXPIRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- جدول المتقدمين
CREATE TABLE IF NOT EXISTS jobs.candidates (
  "id"                    TEXT NOT NULL,
  "positionId"            TEXT,
  "firstNameAr"           TEXT NOT NULL,
  "lastNameAr"            TEXT NOT NULL,
  "firstNameEn"           TEXT,
  "lastNameEn"            TEXT,
  "email"                 TEXT,
  "phone"                 TEXT NOT NULL,
  "nationalId"            TEXT,
  "currentStage"          jobs."CandidateStage" NOT NULL DEFAULT 'NEW',
  "source"                jobs."CandidateSource" NOT NULL DEFAULT 'WEBSITE',
  "cvUrl"                 TEXT,
  "expectedSalary"        DECIMAL(15,2),
  "notes"                 TEXT,
  "isTransferred"         BOOLEAN NOT NULL DEFAULT false,
  "transferredEmployeeId" TEXT,
  "rejectionReason"       TEXT,
  "createdBy"             TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt"             TIMESTAMP(3),
  CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "candidates_currentStage_idx" ON jobs.candidates("currentStage");
CREATE INDEX IF NOT EXISTS "candidates_positionId_idx" ON jobs.candidates("positionId");

ALTER TABLE jobs.candidates DROP CONSTRAINT IF EXISTS "candidates_positionId_fkey";
ALTER TABLE jobs.candidates ADD CONSTRAINT "candidates_positionId_fkey"
  FOREIGN KEY ("positionId") REFERENCES jobs."InterviewPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- سجل تاريخ المراحل
CREATE TABLE IF NOT EXISTS jobs.candidate_stage_history (
  "id"          TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "fromStage"   jobs."CandidateStage",
  "toStage"     jobs."CandidateStage" NOT NULL,
  "notes"       TEXT,
  "changedBy"   TEXT,
  "changedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "candidate_stage_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "candidate_stage_history_candidateId_idx" ON jobs.candidate_stage_history("candidateId");

ALTER TABLE jobs.candidate_stage_history DROP CONSTRAINT IF EXISTS "candidate_stage_history_candidateId_fkey";
ALTER TABLE jobs.candidate_stage_history ADD CONSTRAINT "candidate_stage_history_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES jobs.candidates("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- جدول عروض العمل
CREATE TABLE IF NOT EXISTS jobs.job_offers (
  "id"          TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "positionId"  TEXT,
  "basicSalary" DECIMAL(15,2) NOT NULL,
  "currency"    TEXT NOT NULL DEFAULT 'SYP',
  "startDate"   TIMESTAMP(3),
  "expiresAt"   TIMESTAMP(3),
  "status"      jobs."OfferStatus" NOT NULL DEFAULT 'DRAFT',
  "benefits"    TEXT,
  "notes"       TEXT,
  "sentAt"      TIMESTAMP(3),
  "respondedAt" TIMESTAMP(3),
  "createdBy"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "job_offers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "job_offers_candidateId_idx" ON jobs.job_offers("candidateId");
CREATE INDEX IF NOT EXISTS "job_offers_status_idx" ON jobs.job_offers("status");

ALTER TABLE jobs.job_offers DROP CONSTRAINT IF EXISTS "job_offers_candidateId_fkey";
ALTER TABLE jobs.job_offers ADD CONSTRAINT "job_offers_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES jobs.candidates("id") ON DELETE CASCADE ON UPDATE CASCADE;
