SET search_path TO clinic_podiatry;

ALTER TABLE podiatry_receptions
  ADD COLUMN IF NOT EXISTS "footSymptomsRight" TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "footSymptomsLeft"  TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "visitTypesRight"   TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "visitTypesLeft"    TEXT[] DEFAULT '{}';
