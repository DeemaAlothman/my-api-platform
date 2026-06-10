-- إضافة حقول الشكوى المرضية + حقل "آخر" لأنواع الألم (إضافية بحتة، آمنة)
ALTER TABLE "clinic_physio"."physio_cases" ADD COLUMN IF NOT EXISTS "complaintType" TEXT;
ALTER TABLE "clinic_physio"."physio_cases" ADD COLUMN IF NOT EXISTS "painLocation" TEXT;
ALTER TABLE "clinic_physio"."physio_cases" ADD COLUMN IF NOT EXISTS "complaintDuration" TEXT;
ALTER TABLE "clinic_physio"."physio_cases" ADD COLUMN IF NOT EXISTS "complaintNotes" TEXT;
ALTER TABLE "clinic_physio"."physio_cases" ADD COLUMN IF NOT EXISTS "hasChronicDiseases" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clinic_physio"."physio_cases" ADD COLUMN IF NOT EXISTS "chronicDiseasesDetail" TEXT;
ALTER TABLE "clinic_physio"."physio_cases" ADD COLUMN IF NOT EXISTS "visitedSpecialist" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clinic_physio"."physio_cases" ADD COLUMN IF NOT EXISTS "hadSurgery" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clinic_physio"."physio_cases" ADD COLUMN IF NOT EXISTS "surgeryDetail" TEXT;
ALTER TABLE "clinic_physio"."physio_cases" ADD COLUMN IF NOT EXISTS "painTypeOther" TEXT;
