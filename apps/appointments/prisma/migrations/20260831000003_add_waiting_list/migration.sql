-- CreateEnum
CREATE TYPE "clinic_appointments"."Gender" AS ENUM ('MALE', 'FEMALE');
CREATE TYPE "clinic_appointments"."ArrivalMethod" AS ENUM ('SOCIAL_MEDIA', 'HOSPITAL', 'DOCTOR', 'ASSOCIATION', 'FRIEND', 'STAFF');
CREATE TYPE "clinic_appointments"."WaitingListStatus" AS ENUM ('WAITING', 'SCHEDULED', 'NOT_SCHEDULED');

-- CreateTable
CREATE TABLE "clinic_appointments"."waiting_list_entries" (
    "id" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "gender" "clinic_appointments"."Gender" NOT NULL,
    "age" INTEGER,
    "registrationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arrivalMethod" "clinic_appointments"."ArrivalMethod",
    "serviceType" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "notes" TEXT,
    "status" "clinic_appointments"."WaitingListStatus" NOT NULL DEFAULT 'WAITING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "waiting_list_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "waiting_list_entries_status_idx" ON "clinic_appointments"."waiting_list_entries"("status");
CREATE INDEX "waiting_list_entries_priority_idx" ON "clinic_appointments"."waiting_list_entries"("priority");
