-- Migration: add therapistIds array to appointments for multi-therapist support
ALTER TABLE clinic_appointments.appointments
  ADD COLUMN IF NOT EXISTS "therapistIds" TEXT[] NOT NULL DEFAULT '{}';
