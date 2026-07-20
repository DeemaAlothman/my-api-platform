ALTER TABLE clinic_prosthetics.committee_reviews
  ADD COLUMN IF NOT EXISTS "decidedByUserId" TEXT;
