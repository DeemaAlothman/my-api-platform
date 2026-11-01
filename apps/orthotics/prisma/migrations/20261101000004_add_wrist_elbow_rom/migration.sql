-- مدى حركة الرسغ والمرفق بتقييم أخصائي العلاج الفيزيائي — عمودان نصيان اختياريان فقط.
ALTER TABLE "clinic_orthotics"."orthotics_receptions"
  ADD COLUMN IF NOT EXISTS "wristROM" TEXT,
  ADD COLUMN IF NOT EXISTS "elbowROM" TEXT;
