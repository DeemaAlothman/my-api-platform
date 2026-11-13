-- سجل التعديل والإلغاء على الاجتماعات الداخلية — إضافة ثلاثة أعمدة اختيارية فقط.
-- status و cancelledReason موجودان أصلاً ولا يُمسّان.
ALTER TABLE "clinic_appointments"."internal_meetings"
  ADD COLUMN IF NOT EXISTS "updatedBy"   TEXT,
  ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
