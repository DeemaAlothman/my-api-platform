-- «سبب زيارة الأخصائي» و«تفاصيل العلاج الفيزيائي السابق» كانا يُخزَّنان في عمودَي
-- «زار طبيباً سابقاً» و«العلاج السابق»، فيمحو أحدهما الآخر عند الحفظ.
--
-- إضافة فقط: عمودان جديدان يقبلان NULL. صفر تعديل وصفر نقل لأي بيانات قائمة —
-- القيم المخزَّنة في previousDoctorSeen و previousTreatment تبقى مكانها كما هي.
ALTER TABLE "clinic_physio"."physio_cases" ADD COLUMN IF NOT EXISTS "specialistReason" TEXT;
ALTER TABLE "clinic_physio"."physio_cases" ADD COLUMN IF NOT EXISTS "previousPTDetail" TEXT;
