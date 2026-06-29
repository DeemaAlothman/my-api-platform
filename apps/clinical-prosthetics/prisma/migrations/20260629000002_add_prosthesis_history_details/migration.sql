ALTER TABLE clinic_prosthetics.prosthetics_cases
  ADD COLUMN IF NOT EXISTS "previousProsthesisWhen" TEXT,
  ADD COLUMN IF NOT EXISTS "previousProsthesisWhere" TEXT,
  ADD COLUMN IF NOT EXISTS "previousProsthesisType" TEXT,
  ADD COLUMN IF NOT EXISTS "physicalTherapyDetails" TEXT;
