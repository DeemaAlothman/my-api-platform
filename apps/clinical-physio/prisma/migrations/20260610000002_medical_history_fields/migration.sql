-- إضافة حقول السجل الطبي الجديدة (إضافية بحتة، آمنة)
ALTER TABLE "clinic_physio"."medical_histories" ADD COLUMN IF NOT EXISTS "pacemakerDetail" TEXT;
ALTER TABLE "clinic_physio"."medical_histories" ADD COLUMN IF NOT EXISTS "hasOtherHealthProblems" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clinic_physio"."medical_histories" ADD COLUMN IF NOT EXISTS "previousComplaintsSurgeries" TEXT;
ALTER TABLE "clinic_physio"."medical_histories" ADD COLUMN IF NOT EXISTS "hadPTSameProblem" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clinic_physio"."medical_histories" ADD COLUMN IF NOT EXISTS "ptSameProblemDetail" TEXT;
ALTER TABLE "clinic_physio"."medical_histories" ADD COLUMN IF NOT EXISTS "otherTreatmentDetail" TEXT;
ALTER TABLE "clinic_physio"."medical_histories" ADD COLUMN IF NOT EXISTS "newAnalysisAttachment" TEXT;
ALTER TABLE "clinic_physio"."medical_histories" ADD COLUMN IF NOT EXISTS "oldAnalysisAttachment" TEXT;
ALTER TABLE "clinic_physio"."medical_histories" ADD COLUMN IF NOT EXISTS "boneDensityTest" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clinic_physio"."medical_histories" ADD COLUMN IF NOT EXISTS "boneDensityDetail" TEXT;
ALTER TABLE "clinic_physio"."medical_histories" ADD COLUMN IF NOT EXISTS "hospitalizedDetail" TEXT;
