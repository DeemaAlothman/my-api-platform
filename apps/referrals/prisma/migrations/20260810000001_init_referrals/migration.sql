-- Create schema
CREATE SCHEMA IF NOT EXISTS referrals;

-- Create enums
CREATE TYPE referrals."SourceType" AS ENUM ('DOCTOR', 'HOSPITAL', 'ASSOCIATION');
CREATE TYPE referrals."VisitType"  AS ENUM ('INTRODUCTORY', 'FOLLOW_UP');

-- referral_sources
CREATE TABLE referrals.referral_sources (
  id                    TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  type                  referrals."SourceType" NOT NULL,
  name                  TEXT        NOT NULL,
  specialty             TEXT,
  city                  TEXT,
  region                TEXT,
  street                TEXT,
  landmark              TEXT,
  floor                 TEXT,
  address               TEXT,
  "clinicPhone"         TEXT,
  mobile                TEXT,
  "clinicRating"        INTEGER,
  "patientDensityRating" INTEGER,
  interests             TEXT[]      NOT NULL DEFAULT '{}',
  "visitDays"           TEXT,
  notes                 TEXT,
  "deletedAt"           TIMESTAMPTZ,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdBy"           TEXT        NOT NULL,
  CONSTRAINT referral_sources_pkey PRIMARY KEY (id)
);

-- referral_visits
CREATE TABLE referrals.referral_visits (
  id              TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "sourceId"      TEXT        NOT NULL,
  "visitType"     referrals."VisitType" NOT NULL,
  "visitDate"     TIMESTAMPTZ NOT NULL,
  topics          TEXT,
  "nextVisitDate" TIMESTAMPTZ,
  "visitedBy"     TEXT        NOT NULL,
  notes           TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT referral_visits_pkey PRIMARY KEY (id),
  CONSTRAINT referral_visits_sourceId_fkey
    FOREIGN KEY ("sourceId") REFERENCES referrals.referral_sources(id)
);
