-- تفصيل المقوية العضلية لكل منطقة/جهة — إضافة عمود JSONB اختياري فقط.
-- muscleTone و spasticityLevel القديمان يبقيان كما هما بلا أي مساس.
ALTER TABLE "clinic_orthotics"."orthotics_receptions"
  ADD COLUMN IF NOT EXISTS "muscleToneDetails" JSONB;
