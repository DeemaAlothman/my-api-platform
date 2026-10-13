-- CreateEnum
CREATE TYPE "clinic_appointments"."InternalMeetingType" AS ENUM ('MEETING', 'TRAINING');

-- CreateEnum
CREATE TYPE "clinic_appointments"."InternalMeetingStatus" AS ENUM ('SCHEDULED', 'CANCELLED');

-- CreateTable
CREATE TABLE "clinic_appointments"."internal_meetings" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meetingType" "clinic_appointments"."InternalMeetingType" NOT NULL,
    "attendeeIds" TEXT[],
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "status" "clinic_appointments"."InternalMeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "cancelledReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "internal_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "internal_meetings_startTime_idx" ON "clinic_appointments"."internal_meetings"("startTime");
