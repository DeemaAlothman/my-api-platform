ALTER TYPE clinic_appointments."AppointmentType" ADD VALUE IF NOT EXISTS 'EXAMINATION';

ALTER TABLE clinic_appointments.appointments
  ADD COLUMN IF NOT EXISTS "physiotherapistId" TEXT;
