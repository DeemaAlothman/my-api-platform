-- تحويل complaintStartDate من تاريخ إلى نص حر — آمن، يحفظ القيم الموجودة كـ YYYY-MM-DD
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'clinic_physio' AND table_name = 'physio_cases'
      AND column_name = 'complaintStartDate' AND data_type LIKE 'timestamp%'
  ) THEN
    ALTER TABLE "clinic_physio"."physio_cases"
      ALTER COLUMN "complaintStartDate" TYPE TEXT
      USING (CASE WHEN "complaintStartDate" IS NULL THEN NULL
                  ELSE to_char("complaintStartDate", 'YYYY-MM-DD') END);
  END IF;
END $$;
