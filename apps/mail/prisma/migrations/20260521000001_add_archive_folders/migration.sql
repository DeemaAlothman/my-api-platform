SET search_path TO mail;

-- CreateTable: mail_archive_folders
CREATE TABLE IF NOT EXISTS mail_archive_folders (
  "id"        TEXT NOT NULL,
  "ownerId"   TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "mail_archive_folders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "mail_archive_folders_ownerId_idx" ON mail_archive_folders("ownerId");

-- AddColumn: archiveFolderId on mail_recipients
ALTER TABLE mail_recipients ADD COLUMN IF NOT EXISTS "archiveFolderId" TEXT;

ALTER TABLE mail_recipients
  ADD CONSTRAINT "mail_recipients_archiveFolderId_fkey"
  FOREIGN KEY ("archiveFolderId") REFERENCES mail_archive_folders("id") ON DELETE SET NULL ON UPDATE CASCADE;
