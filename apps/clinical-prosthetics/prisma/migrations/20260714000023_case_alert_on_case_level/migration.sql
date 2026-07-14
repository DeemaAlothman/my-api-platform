-- نقل حقول التنبيه من الجلسة إلى الحالة
ALTER TABLE clinic_prosthetics.prosthetics_cases
  ADD COLUMN IF NOT EXISTS "alertNote"         TEXT,
  ADD COLUMN IF NOT EXISTS "alertSentAt"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "alertSentByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "alertResponseNote" TEXT,
  ADD COLUMN IF NOT EXISTS "alertRespondedAt"  TIMESTAMP(3);

ALTER TABLE clinic_prosthetics.case_treatment_programs
  DROP COLUMN IF EXISTS "alertNote",
  DROP COLUMN IF EXISTS "alertSentAt",
  DROP COLUMN IF EXISTS "alertSentByUserId",
  DROP COLUMN IF EXISTS "alertResponseNote",
  DROP COLUMN IF EXISTS "alertRespondedAt";
