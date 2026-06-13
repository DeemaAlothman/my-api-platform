-- تحويل receivesAid من Boolean إلى نص (اسم الجهة) — آمن، يحفظ البيانات (true→نعم، false→NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'clinic_patients' AND table_name = 'patients'
      AND column_name = 'receivesAid' AND data_type = 'boolean'
  ) THEN
    ALTER TABLE "clinic_patients"."patients" ALTER COLUMN "receivesAid" DROP DEFAULT;
    ALTER TABLE "clinic_patients"."patients" ALTER COLUMN "receivesAid" DROP NOT NULL;
    ALTER TABLE "clinic_patients"."patients"
      ALTER COLUMN "receivesAid" TYPE TEXT
      USING (CASE WHEN "receivesAid" THEN 'نعم' ELSE NULL END);
  END IF;
END $$;
