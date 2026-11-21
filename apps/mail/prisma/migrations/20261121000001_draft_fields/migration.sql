SET search_path TO mail;

-- حقول تحتاجها المسودة لتُستأنف كما تُركت: الأقسام المختارة، ونوع الرد عند
-- الجواب أو التحويل. (الموضوع والنص والمستلمون والمرفقات و parentMessageId
-- محفوظة أصلاً في أعمدة وجداول قائمة.)
--
-- إضافة فقط: عمودان جديدان، أحدهما بقيمة افتراضية فارغة والآخر يقبل NULL.
-- صفر تعديل وصفر نقل لأي رسالة قائمة.
ALTER TABLE mail_messages ADD COLUMN IF NOT EXISTS "departmentIds" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE mail_messages ADD COLUMN IF NOT EXISTS "replyType" TEXT;
