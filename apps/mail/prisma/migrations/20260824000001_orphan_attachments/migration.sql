SET search_path TO mail;

-- messageId يصبح nullable (مرفق يتيم قبل الربط برسالة)
ALTER TABLE mail_attachments ALTER COLUMN "messageId" DROP NOT NULL;

-- uploadedBy: userId للمستخدم الذي رفع المرفق اليتيم
ALTER TABLE mail_attachments ADD COLUMN IF NOT EXISTS "uploadedBy" TEXT;

CREATE INDEX IF NOT EXISTS "mail_attachments_uploadedBy_idx" ON mail_attachments ("uploadedBy");
