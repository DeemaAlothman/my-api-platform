SET search_path TO clinic_podiatry;

ALTER TABLE podiatry_sessions
  ADD COLUMN IF NOT EXISTS "shoeSize" INTEGER;
