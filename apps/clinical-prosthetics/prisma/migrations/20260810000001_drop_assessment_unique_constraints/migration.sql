-- حذف الـ unique constraints من جداول التقييمات
-- يسمح بأكثر من تقييم لنفس الجانب في نفس الحالة
-- لا تأثير على البيانات الموجودة

-- upper_limb و lower_limb (UNIQUE INDEX)
DROP INDEX IF EXISTS clinic_prosthetics."upper_limb_assessments_caseId_side_key";
DROP INDEX IF EXISTS clinic_prosthetics."lower_limb_assessments_caseId_side_key";

-- باقي جداول التقييمات (CONSTRAINT)
ALTER TABLE clinic_prosthetics.ankle_disarticulation_assessments  DROP CONSTRAINT IF EXISTS "ankle_disarticulation_assessments_caseId_side_key";
ALTER TABLE clinic_prosthetics.knee_disarticulation_assessments    DROP CONSTRAINT IF EXISTS "knee_disarticulation_assessments_caseId_side_key";
ALTER TABLE clinic_prosthetics.transfemoral_assessments            DROP CONSTRAINT IF EXISTS "transfemoral_assessments_caseId_side_key";
ALTER TABLE clinic_prosthetics.transtibial_assessments             DROP CONSTRAINT IF EXISTS "transtibial_assessments_caseId_side_key";
ALTER TABLE clinic_prosthetics.hemipelvectomy_assessments          DROP CONSTRAINT IF EXISTS "hemipelvectomy_assessments_caseId_side_key";
ALTER TABLE clinic_prosthetics.transradial_assessments             DROP CONSTRAINT IF EXISTS "transradial_assessments_caseId_side_key";
ALTER TABLE clinic_prosthetics.elbow_disarticulation_assessments   DROP CONSTRAINT IF EXISTS "elbow_disarticulation_assessments_caseId_side_key";
ALTER TABLE clinic_prosthetics.transhumeral_assessments            DROP CONSTRAINT IF EXISTS "transhumeral_assessments_caseId_side_key";
