-- تفصيل الإحساس لكل منطقة/جهة — إضافة عمود JSONB اختياري فقط.
-- حقل sensation القديم يبقى كما هو بلا أي مساس.
ALTER TABLE "clinic_orthotics"."orthotics_receptions"
  ADD COLUMN IF NOT EXISTS "sensationDetails" JSONB;
