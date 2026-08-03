-- Make practitionerRole optional and add departmentId
ALTER TABLE clinic_appointments.appointments
  ALTER COLUMN "practitionerRole" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "departmentId" TEXT;
