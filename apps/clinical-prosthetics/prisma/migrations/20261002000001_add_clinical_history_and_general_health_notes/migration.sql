-- القصة السريرية على الحالة نفسها
ALTER TABLE "clinic_prosthetics"."prosthetics_cases" ADD COLUMN "clinicalHistory" TEXT;

-- حالة الصحة العامة على تقييم الطرف العلوي والسفلي
ALTER TABLE "clinic_prosthetics"."upper_limb_assessments" ADD COLUMN "generalHealthNotes" TEXT;
ALTER TABLE "clinic_prosthetics"."lower_limb_assessments" ADD COLUMN "generalHealthNotes" TEXT;

-- حقول موجودة أصلاً بالسفلي وناقصة بالعلوي، + ملاحظات إغلاق الجذمور (جديد، للعلوي)
ALTER TABLE "clinic_prosthetics"."upper_limb_assessments" ADD COLUMN "amputationLevelNote" TEXT;
ALTER TABLE "clinic_prosthetics"."upper_limb_assessments" ADD COLUMN "otherLimbCondition" TEXT;
ALTER TABLE "clinic_prosthetics"."upper_limb_assessments" ADD COLUMN "closureNotes" TEXT;
