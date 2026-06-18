-- تحويل من/إلى (treatmentFrom/treatmentTo) من تاريخ إلى نص حر — آمن، يحفظ القيم كـ YYYY-MM-DD
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='clinic_physio' AND table_name='physio_cases' AND column_name='treatmentFrom' AND data_type LIKE 'timestamp%') THEN
    ALTER TABLE "clinic_physio"."physio_cases" ALTER COLUMN "treatmentFrom" TYPE TEXT
      USING (CASE WHEN "treatmentFrom" IS NULL THEN NULL ELSE to_char("treatmentFrom", 'YYYY-MM-DD') END);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='clinic_physio' AND table_name='physio_cases' AND column_name='treatmentTo' AND data_type LIKE 'timestamp%') THEN
    ALTER TABLE "clinic_physio"."physio_cases" ALTER COLUMN "treatmentTo" TYPE TEXT
      USING (CASE WHEN "treatmentTo" IS NULL THEN NULL ELSE to_char("treatmentTo", 'YYYY-MM-DD') END);
  END IF;
END $$;
