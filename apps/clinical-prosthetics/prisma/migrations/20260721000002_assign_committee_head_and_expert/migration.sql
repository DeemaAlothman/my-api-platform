ALTER TABLE clinic_prosthetics.committee_reviews
  ADD COLUMN IF NOT EXISTS "assignedCommitteeHeadUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedExpertUserId"        TEXT;
