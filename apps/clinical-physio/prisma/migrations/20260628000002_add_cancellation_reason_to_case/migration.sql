ALTER TABLE clinic_physio.physio_cases
  ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;
