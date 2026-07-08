-- إزالة الـ unique constraint من كل جداول التقييم
-- بعد هذا يصير ممكن تسجيل أكثر من قياس لنفس الحالة والجهة

DROP INDEX IF EXISTS "clinic_prosthetics"."upper_limb_assessments_caseId_side_key";
DROP INDEX IF EXISTS "clinic_prosthetics"."lower_limb_assessments_caseId_side_key";
DROP INDEX IF EXISTS "clinic_prosthetics"."ankle_disarticulation_assessments_caseId_side_key";
DROP INDEX IF EXISTS "clinic_prosthetics"."knee_disarticulation_assessments_caseId_side_key";
DROP INDEX IF EXISTS "clinic_prosthetics"."transfemoral_assessments_caseId_side_key";
DROP INDEX IF EXISTS "clinic_prosthetics"."transtibial_assessments_caseId_side_key";
DROP INDEX IF EXISTS "clinic_prosthetics"."hemipelvectomy_assessments_caseId_side_key";
DROP INDEX IF EXISTS "clinic_prosthetics"."transradial_assessments_caseId_side_key";
DROP INDEX IF EXISTS "clinic_prosthetics"."elbow_disarticulation_assessments_caseId_side_key";
DROP INDEX IF EXISTS "clinic_prosthetics"."transhumeral_assessments_caseId_side_key";

-- إنشاء index عادي بدلاً منها (للبحث السريع)
CREATE INDEX IF NOT EXISTS "upper_limb_assessments_caseId_side_idx"        ON "clinic_prosthetics"."upper_limb_assessments"("caseId", "side");
CREATE INDEX IF NOT EXISTS "lower_limb_assessments_caseId_side_idx"        ON "clinic_prosthetics"."lower_limb_assessments"("caseId", "side");
CREATE INDEX IF NOT EXISTS "ankle_disarticulation_assessments_caseId_idx"  ON "clinic_prosthetics"."ankle_disarticulation_assessments"("caseId", "side");
CREATE INDEX IF NOT EXISTS "knee_disarticulation_assessments_caseId_idx"   ON "clinic_prosthetics"."knee_disarticulation_assessments"("caseId", "side");
CREATE INDEX IF NOT EXISTS "transfemoral_assessments_caseId_side_idx"      ON "clinic_prosthetics"."transfemoral_assessments"("caseId", "side");
CREATE INDEX IF NOT EXISTS "transtibial_assessments_caseId_side_idx"       ON "clinic_prosthetics"."transtibial_assessments"("caseId", "side");
CREATE INDEX IF NOT EXISTS "hemipelvectomy_assessments_caseId_side_idx"    ON "clinic_prosthetics"."hemipelvectomy_assessments"("caseId", "side");
CREATE INDEX IF NOT EXISTS "transradial_assessments_caseId_side_idx"       ON "clinic_prosthetics"."transradial_assessments"("caseId", "side");
CREATE INDEX IF NOT EXISTS "elbow_disarticulation_assessments_caseId_idx"  ON "clinic_prosthetics"."elbow_disarticulation_assessments"("caseId", "side");
CREATE INDEX IF NOT EXISTS "transhumeral_assessments_caseId_side_idx"      ON "clinic_prosthetics"."transhumeral_assessments"("caseId", "side");
