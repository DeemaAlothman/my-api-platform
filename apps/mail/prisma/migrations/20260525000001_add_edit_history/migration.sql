SET search_path TO mail;

ALTER TABLE mail_messages ADD COLUMN IF NOT EXISTS "editHistory" JSONB NOT NULL DEFAULT '[]';
