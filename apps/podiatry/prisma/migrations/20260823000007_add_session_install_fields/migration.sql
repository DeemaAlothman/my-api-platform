SET search_path TO clinic_podiatry;

ALTER TABLE podiatry_sessions
  ADD COLUMN IF NOT EXISTS "installedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "installedBy" TEXT;
