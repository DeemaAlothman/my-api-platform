-- نقل التقييم ليُخزّن على الحالة (مثل الشكوى) — إضافي بحت + نقل آمن للبيانات
ALTER TABLE "clinic_physio"."physio_cases" ADD COLUMN IF NOT EXISTS "evalModalities" "clinic_physio"."TherapyModality"[] DEFAULT ARRAY[]::"clinic_physio"."TherapyModality"[];
ALTER TABLE "clinic_physio"."physio_cases" ADD COLUMN IF NOT EXISTS "evalOtherModality" TEXT;
ALTER TABLE "clinic_physio"."physio_cases" ADD COLUMN IF NOT EXISTS "evalNotes" TEXT;
ALTER TABLE "clinic_physio"."physio_cases" ADD COLUMN IF NOT EXISTS "evalSummary" TEXT;

-- نقل أي بيانات تقييم موجودة من الجدول المنفصل القديم (إن وُجد) إلى الحالة — لا يُحذف الجدول القديم
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'clinic_physio' AND table_name = 'physio_evaluations'
  ) THEN
    UPDATE "clinic_physio"."physio_cases" c
    SET "evalModalities"    = COALESCE(e."modalities", c."evalModalities"),
        "evalOtherModality" = COALESCE(e."otherModality", c."evalOtherModality"),
        "evalNotes"         = COALESCE(e."notes", c."evalNotes"),
        "evalSummary"       = COALESCE(e."evaluation", c."evalSummary")
    FROM "clinic_physio"."physio_evaluations" e
    WHERE e."caseId" = c."id";
  END IF;
END $$;
