-- AddValue: REHABILITATION to AppointmentType
ALTER TYPE clinic_appointments."AppointmentType" ADD VALUE IF NOT EXISTS 'REHABILITATION';
