-- AlterEnum
ALTER TYPE "clinic_appointments"."InternalMeetingType" ADD VALUE 'PHOTOGRAPHY';
ALTER TYPE "clinic_appointments"."InternalMeetingType" ADD VALUE 'LECTURE';
ALTER TYPE "clinic_appointments"."InternalMeetingType" ADD VALUE 'EVENT';
ALTER TYPE "clinic_appointments"."InternalMeetingType" ADD VALUE 'EXTERNAL_MISSION';
ALTER TYPE "clinic_appointments"."InternalMeetingType" ADD VALUE 'VISIT';
ALTER TYPE "clinic_appointments"."InternalMeetingType" ADD VALUE 'OTHER';

-- AlterTable
ALTER TABLE "clinic_appointments"."internal_meetings" ADD COLUMN "meetingTypeOther" TEXT;
