-- إعادة فتح الحالة المسلَّمة — أعمدة اختيارية فقط، ولا مساس بـ status ولا بأي تاريخ تسليم.
ALTER TABLE "clinic_prosthetics"."prosthetics_cases"
  ADD COLUMN IF NOT EXISTS "isReopened"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reopenedBy"        TEXT,
  ADD COLUMN IF NOT EXISTS "reopenedAt"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reopenReason"      TEXT,
  ADD COLUMN IF NOT EXISTS "relockedBy"        TEXT,
  ADD COLUMN IF NOT EXISTS "relockedAt"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "relockForced"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "relockForceReason" TEXT;

-- الحقول الناقصة المحسوبة والمخزَّنة — تُملأ بسكربت backfill-missing-fields لمرة واحدة
ALTER TABLE "clinic_prosthetics"."prosthetics_cases"
  ADD COLUMN IF NOT EXISTS "hasMissingFields" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "missingFields"    JSONB,
  ADD COLUMN IF NOT EXISTS "missingFieldsAt"  TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "prosthetics_cases_hasMissingFields_idx"
  ON "clinic_prosthetics"."prosthetics_cases" ("hasMissingFields");
