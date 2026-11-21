-- عدد الأطراف المسلَّمة في نموذج التسليم النهائي. لا يُشتق من عدد القطع، لأن
-- الطرف الواحد يتكوّن من عدة قطع.
--
-- إضافة فقط: عمود واحد يقبل NULL. صفر تعديل وصفر حذف لأي نموذج تسليم قائم —
-- النماذج السابقة تبقى بقيمة فارغة لأن العدد لم يكن يُسجَّل وقتها.
ALTER TABLE "clinic_prosthetics"."final_delivery_forms"
  ADD COLUMN IF NOT EXISTS "deliveredLimbsCount" INTEGER;
