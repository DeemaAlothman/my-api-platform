-- AlterEnum
ALTER TYPE "patient_app"."NotificationType" ADD VALUE 'NEW_CHAT_MESSAGE';

-- CreateEnum
CREATE TYPE "patient_app"."ChatSenderType" AS ENUM ('PATIENT', 'THERAPIST');

-- CreateTable
CREATE TABLE "patient_app"."chat_conversations" (
    "id" TEXT NOT NULL,
    "erpPatientId" TEXT NOT NULL,
    "erpTherapistId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_app"."chat_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderType" "patient_app"."ChatSenderType" NOT NULL,
    "senderId" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_app"."therapist_ratings" (
    "id" TEXT NOT NULL,
    "erpSessionId" TEXT NOT NULL,
    "erpPatientId" TEXT NOT NULL,
    "erpTherapistId" TEXT NOT NULL,
    "patientAccountId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "privateNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "therapist_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_conversations_erpPatientId_active_idx" ON "patient_app"."chat_conversations"("erpPatientId", "active");

-- CreateIndex
CREATE INDEX "chat_conversations_erpTherapistId_active_idx" ON "patient_app"."chat_conversations"("erpTherapistId", "active");

-- CreateIndex
CREATE INDEX "chat_messages_conversationId_sentAt_idx" ON "patient_app"."chat_messages"("conversationId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "therapist_ratings_erpSessionId_key" ON "patient_app"."therapist_ratings"("erpSessionId");

-- CreateIndex
CREATE INDEX "therapist_ratings_erpTherapistId_idx" ON "patient_app"."therapist_ratings"("erpTherapistId");

-- CreateIndex
CREATE INDEX "therapist_ratings_erpPatientId_idx" ON "patient_app"."therapist_ratings"("erpPatientId");

-- AddForeignKey
ALTER TABLE "patient_app"."chat_messages" ADD CONSTRAINT "chat_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "patient_app"."chat_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
