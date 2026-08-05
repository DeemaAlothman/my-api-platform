CREATE TYPE clinic_physio."CaseType" AS ENUM ('PHYSIO', 'DOCTOR_EXAM');

ALTER TABLE clinic_physio.physio_cases
  ADD COLUMN IF NOT EXISTS "caseType" clinic_physio."CaseType" NOT NULL DEFAULT 'PHYSIO';
