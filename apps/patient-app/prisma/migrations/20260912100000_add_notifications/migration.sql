-- CreateEnum
CREATE TYPE "patient_app"."DevicePlatform" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- CreateEnum
CREATE TYPE "patient_app"."NotificationType" AS ENUM ('DAILY_REMINDER', 'PROGRAM_ASSIGNED', 'PROGRAM_UPDATED', 'PROGRAM_CANCELLED', 'PROGRAM_REORDERED', 'APPOINTMENT_CREATED');

-- CreateTable
CREATE TABLE "patient_app"."device_tokens" (
    "id" TEXT NOT NULL,
    "patientAccountId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "patient_app"."DevicePlatform" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_app"."notification_logs" (
    "id" TEXT NOT NULL,
    "patientAccountId" TEXT NOT NULL,
    "erpPatientId" TEXT NOT NULL,
    "type" "patient_app"."NotificationType" NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "bodyAr" TEXT NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "payloadJson" JSONB,
    "pushAttempted" BOOLEAN NOT NULL DEFAULT false,
    "pushDelivered" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_token_key" ON "patient_app"."device_tokens"("token");

-- CreateIndex
CREATE INDEX "device_tokens_patientAccountId_idx" ON "patient_app"."device_tokens"("patientAccountId");

-- CreateIndex
CREATE INDEX "notification_logs_patientAccountId_sentAt_idx" ON "patient_app"."notification_logs"("patientAccountId", "sentAt");

-- AddForeignKey
ALTER TABLE "patient_app"."device_tokens" ADD CONSTRAINT "device_tokens_patientAccountId_fkey" FOREIGN KEY ("patientAccountId") REFERENCES "patient_app"."patient_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_app"."notification_logs" ADD CONSTRAINT "notification_logs_patientAccountId_fkey" FOREIGN KEY ("patientAccountId") REFERENCES "patient_app"."patient_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
