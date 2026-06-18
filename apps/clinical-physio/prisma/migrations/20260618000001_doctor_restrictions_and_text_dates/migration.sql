-- 1) سؤال «هل نصحك طبيبك بعدم القيام بشيء» (نعم/لا) — إضافي
ALTER TABLE "clinic_physio"."medical_histories" ADD COLUMN IF NOT EXISTS "hasDoctorRestrictions" BOOLEAN NOT NULL DEFAULT false;

-- 2) تاريخ التحليل (جديد/قديم) → نص حر (تحويل آمن يحفظ القيم كـ YYYY-MM-DD)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='clinic_physio' AND table_name='medical_histories' AND column_name='newAnalysisDate' AND data_type LIKE 'timestamp%') THEN
    ALTER TABLE "clinic_physio"."medical_histories" ALTER COLUMN "newAnalysisDate" TYPE TEXT
      USING (CASE WHEN "newAnalysisDate" IS NULL THEN NULL ELSE to_char("newAnalysisDate", 'YYYY-MM-DD') END);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='clinic_physio' AND table_name='medical_histories' AND column_name='oldAnalysisDate' AND data_type LIKE 'timestamp%') THEN
    ALTER TABLE "clinic_physio"."medical_histories" ALTER COLUMN "oldAnalysisDate" TYPE TEXT
      USING (CASE WHEN "oldAnalysisDate" IS NULL THEN NULL ELSE to_char("oldAnalysisDate", 'YYYY-MM-DD') END);
  END IF;

  -- 3) تاريخ العملية الجراحية → نص حر
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='clinic_physio' AND table_name='surgeries' AND column_name='date' AND data_type LIKE 'timestamp%') THEN
    ALTER TABLE "clinic_physio"."surgeries" ALTER COLUMN "date" TYPE TEXT
      USING (CASE WHEN "date" IS NULL THEN NULL ELSE to_char("date", 'YYYY-MM-DD') END);
  END IF;
END $$;
