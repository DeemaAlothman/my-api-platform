ALTER TABLE clinic_prosthetics.prosthetics_cases
  ADD COLUMN IF NOT EXISTS "prosthesisSuitable"     BOOLEAN,
  ADD COLUMN IF NOT EXISTS "proposedProsthesisType" TEXT;
