-- الطرف العلوي: النوروم العصبي + هل يستخدم طرف صناعي
ALTER TABLE clinic_prosthetics.upper_limb_assessments
  ADD COLUMN IF NOT EXISTS "neuromaPresent"     BOOLEAN,
  ADD COLUMN IF NOT EXISTS "usesProstheticLimb" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "prostheticLimbType" TEXT;

-- الطرف السفلي: هل يستخدم طرف صناعي
ALTER TABLE clinic_prosthetics.lower_limb_assessments
  ADD COLUMN IF NOT EXISTS "usesProstheticLimb" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "prostheticLimbType" TEXT;
