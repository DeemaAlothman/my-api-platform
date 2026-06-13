-- تحويل hadPreviousInjury من Boolean إلى نص — آمن، يحفظ البيانات (true→نعم، false→NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'clinic_physio' AND table_name = 'physio_cases'
      AND column_name = 'hadPreviousInjury' AND data_type = 'boolean'
  ) THEN
    ALTER TABLE "clinic_physio"."physio_cases" ALTER COLUMN "hadPreviousInjury" DROP DEFAULT;
    ALTER TABLE "clinic_physio"."physio_cases" ALTER COLUMN "hadPreviousInjury" DROP NOT NULL;
    ALTER TABLE "clinic_physio"."physio_cases"
      ALTER COLUMN "hadPreviousInjury" TYPE TEXT
      USING (CASE WHEN "hadPreviousInjury" THEN 'نعم' ELSE NULL END);
  END IF;
END $$;
