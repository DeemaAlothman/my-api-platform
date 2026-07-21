ALTER TABLE users.employees ADD COLUMN IF NOT EXISTS "signatureBase64"    TEXT;
ALTER TABLE users.employees ADD COLUMN IF NOT EXISTS "signatureUpdatedAt" TIMESTAMP(3);
