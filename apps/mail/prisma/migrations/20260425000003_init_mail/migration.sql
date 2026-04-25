-- CreateSchema
CREATE SCHEMA IF NOT EXISTS mail;

SET search_path TO mail;

-- CreateEnum
CREATE TYPE "RecipientType" AS ENUM ('TO', 'CC', 'BCC');
CREATE TYPE "MailFolder" AS ENUM ('INBOX', 'SENT', 'DRAFTS', 'ARCHIVE', 'TRASH');

-- CreateTable: mail_messages
CREATE TABLE IF NOT EXISTS mail_messages (
  "id"              TEXT NOT NULL,
  "senderId"        TEXT NOT NULL,
  "subject"         TEXT NOT NULL,
  "body"            TEXT NOT NULL,
  "threadRootId"    TEXT,
  "parentMessageId" TEXT,
  "isDraft"         BOOLEAN NOT NULL DEFAULT false,
  "deletedAt"       TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "mail_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable: mail_recipients
CREATE TABLE IF NOT EXISTS mail_recipients (
  "id"          TEXT NOT NULL,
  "messageId"   TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "type"        "RecipientType" NOT NULL,
  "folder"      "MailFolder" NOT NULL DEFAULT 'INBOX',
  "isRead"      BOOLEAN NOT NULL DEFAULT false,
  "readAt"      TIMESTAMP(3),
  "isStarred"   BOOLEAN NOT NULL DEFAULT false,
  "deletedAt"   TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "mail_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable: mail_attachments
CREATE TABLE IF NOT EXISTS mail_attachments (
  "id"        TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "fileUrl"   TEXT NOT NULL,
  "fileName"  TEXT NOT NULL,
  "fileSize"  INTEGER NOT NULL,
  "mimeType"  TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "mail_attachments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE mail_recipients
  ADD CONSTRAINT "mail_recipients_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES mail_messages("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE mail_attachments
  ADD CONSTRAINT "mail_attachments_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES mail_messages("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mail_messages_senderId_idx" ON mail_messages("senderId");
CREATE INDEX IF NOT EXISTS "mail_messages_isDraft_idx"  ON mail_messages("isDraft");
CREATE INDEX IF NOT EXISTS "mail_messages_threadRootId_idx" ON mail_messages("threadRootId");

CREATE INDEX IF NOT EXISTS "mail_recipients_recipientId_folder_idx"    ON mail_recipients("recipientId", "folder");
CREATE INDEX IF NOT EXISTS "mail_recipients_recipientId_isRead_idx"    ON mail_recipients("recipientId", "isRead");
CREATE INDEX IF NOT EXISTS "mail_recipients_recipientId_isStarred_idx" ON mail_recipients("recipientId", "isStarred");
CREATE UNIQUE INDEX IF NOT EXISTS "mail_recipients_messageId_recipientId_key" ON mail_recipients("messageId", "recipientId");

CREATE INDEX IF NOT EXISTS "mail_attachments_messageId_idx" ON mail_attachments("messageId");
