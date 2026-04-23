-- AddColumn: imageUrl to departments (additive only)
ALTER TABLE "users"."departments" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

-- AddColumn: fileUrl to departments (additive only)
ALTER TABLE "users"."departments" ADD COLUMN IF NOT EXISTS "fileUrl" TEXT;
