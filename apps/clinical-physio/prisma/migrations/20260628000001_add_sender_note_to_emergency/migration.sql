ALTER TABLE clinic_physio.physio_emergency_alerts
  ADD COLUMN IF NOT EXISTS "senderNote" TEXT;
