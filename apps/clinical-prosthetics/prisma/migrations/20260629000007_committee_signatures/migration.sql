ALTER TABLE "clinic_prosthetics"."committee_reviews"
  ADD COLUMN IF NOT EXISTS "prosthetistSignatureBase64" TEXT,
  ADD COLUMN IF NOT EXISTS "prosthetistSignedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "prosthetistSignatureIp" TEXT,
  ADD COLUMN IF NOT EXISTS "physiotherapistSignatureBase64" TEXT,
  ADD COLUMN IF NOT EXISTS "physiotherapistSignedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "physiotherapistSignatureIp" TEXT;
