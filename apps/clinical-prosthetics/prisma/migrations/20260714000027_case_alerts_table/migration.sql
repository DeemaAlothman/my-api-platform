-- جدول التنبيهات المتعددة على مستوى الحالة
CREATE TABLE clinic_prosthetics.case_alerts (
  id             TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "caseId"       TEXT        NOT NULL,
  note           TEXT        NOT NULL,
  "sentAt"       TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "sentByUserId" TEXT        NOT NULL,
  "responseNote" TEXT,
  "respondedAt"  TIMESTAMP(3),
  CONSTRAINT "case_alerts_pkey" PRIMARY KEY (id)
);

ALTER TABLE clinic_prosthetics.case_alerts
  ADD CONSTRAINT "case_alerts_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES clinic_prosthetics.prosthetics_cases(id) ON DELETE CASCADE;

CREATE INDEX "case_alerts_caseId_idx" ON clinic_prosthetics.case_alerts ("caseId");

-- حذف الحقول القديمة (كانت تسمح بتنبيه واحد فقط)
ALTER TABLE clinic_prosthetics.prosthetics_cases
  DROP COLUMN IF EXISTS "alertNote",
  DROP COLUMN IF EXISTS "alertSentAt",
  DROP COLUMN IF EXISTS "alertSentByUserId",
  DROP COLUMN IF EXISTS "alertResponseNote",
  DROP COLUMN IF EXISTS "alertRespondedAt";
