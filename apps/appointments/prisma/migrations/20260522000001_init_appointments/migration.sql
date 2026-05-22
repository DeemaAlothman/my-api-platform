-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "clinic_appointments";

-- CreateEnum
CREATE TYPE "clinic_appointments"."CaseType" AS ENUM ('PROSTHETICS', 'PHYSIO', 'GENERAL');
CREATE TYPE "clinic_appointments"."AppointmentType" AS ENUM ('ASSESSMENT', 'FITTING', 'SESSION', 'FOLLOW_UP', 'COMMITTEE');
CREATE TYPE "clinic_appointments"."AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED');
CREATE TYPE "clinic_appointments"."ReminderChannel" AS ENUM ('MAIL', 'WHATSAPP');

-- CreateTable
CREATE TABLE "clinic_appointments"."appointments" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "caseId" TEXT,
    "caseType" "clinic_appointments"."CaseType",
    "practitionerId" TEXT NOT NULL,
    "practitionerRole" TEXT NOT NULL,
    "appointmentType" "clinic_appointments"."AppointmentType" NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "status" "clinic_appointments"."AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "reminderChannel" "clinic_appointments"."ReminderChannel",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "cancelledReason" TEXT,
    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "appointments_practitionerId_startTime_idx" ON "clinic_appointments"."appointments"("practitionerId", "startTime");
CREATE INDEX "appointments_patientId_idx" ON "clinic_appointments"."appointments"("patientId");
CREATE INDEX "appointments_status_idx" ON "clinic_appointments"."appointments"("status");
CREATE INDEX "appointments_startTime_idx" ON "clinic_appointments"."appointments"("startTime");
