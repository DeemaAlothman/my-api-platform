-- Make patientId optional and add patientName for walk-in (unregistered) patients
ALTER TABLE clinic_appointments.appointments
  ALTER COLUMN "patientId" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "patientName" TEXT;
