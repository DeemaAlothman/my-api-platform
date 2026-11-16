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
