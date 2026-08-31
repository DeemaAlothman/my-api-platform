ALTER TABLE "clinic_prosthetics"."upper_limb_assessments" ADD COLUMN "limbSavedAt" TIMESTAMP(3);
ALTER TABLE "clinic_prosthetics"."upper_limb_assessments" ADD COLUMN "romSavedAt"  TIMESTAMP(3);

ALTER TABLE "clinic_prosthetics"."lower_limb_assessments" ADD COLUMN "limbSavedAt" TIMESTAMP(3);
ALTER TABLE "clinic_prosthetics"."lower_limb_assessments" ADD COLUMN "romSavedAt"  TIMESTAMP(3);
