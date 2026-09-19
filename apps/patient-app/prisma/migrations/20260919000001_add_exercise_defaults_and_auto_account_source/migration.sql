-- حقول افتراضية إضافية على مستوى تعريف التمرين نفسه (مجموعات/تكرارات/ثبات/راحة) — تُقترح تلقائياً عند تعيين التمرين لجلسة
ALTER TABLE "patient_app"."exercises" ADD COLUMN "defaultSets" INTEGER;
ALTER TABLE "patient_app"."exercises" ADD COLUMN "defaultReps" INTEGER;
ALTER TABLE "patient_app"."exercises" ADD COLUMN "defaultHoldSeconds" INTEGER;
ALTER TABLE "patient_app"."exercises" ADD COLUMN "defaultRestSeconds" INTEGER;

-- مصدر جديد لإنشاء حساب تطبيق المريض تلقائياً عند تحويل حالة إلى علاج فيزيائي
ALTER TYPE "patient_app"."PatientAccountSource" ADD VALUE 'AUTO_CONVERSION';
