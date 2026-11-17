-- ملاحظة نصية اختيارية على تكلفة الضبان (مثلاً «هدية») — إضافة عمود نصي اختياري فقط.
-- لا يلمس أي قيمة موجودة: كل السجلات الحالية تبقى NULL.
ALTER TABLE "clinic_podiatry"."podiatry_sessions"
  ADD COLUMN IF NOT EXISTS "insoleCostNote" TEXT;
