CREATE SCHEMA IF NOT EXISTS "whatsapp";

CREATE TYPE "whatsapp"."SendStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED_NO_PHONE');

CREATE TABLE "whatsapp"."whatsapp_logs" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT,
    "status" "whatsapp"."SendStatus" NOT NULL,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_logs_notificationId_key" ON "whatsapp"."whatsapp_logs"("notificationId");
