-- قوة عضلات الطرف العلوي (العضد والساعد) — إضافة عمودين نصيين اختياريين فقط.
ALTER TABLE "clinic_orthotics"."orthotics_receptions"
  ADD COLUMN IF NOT EXISTS "upperArmMuscleStrength" TEXT,
  ADD COLUMN IF NOT EXISTS "forearmMuscleStrength"  TEXT;
