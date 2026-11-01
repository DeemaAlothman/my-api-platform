-- درجات قوة العضلات (الأطراف والجذع) — عمودان JSONB اختياريان فقط.
-- muscleStrengthMovements و trunkStrengthMovements يبقيان كما هما بلا أي مساس.
ALTER TABLE "clinic_orthotics"."orthotics_receptions"
  ADD COLUMN IF NOT EXISTS "muscleStrengthGrades" JSONB,
  ADD COLUMN IF NOT EXISTS "trunkStrengthGrades"  JSONB;
