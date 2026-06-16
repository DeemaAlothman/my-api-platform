-- تحويل حقول الأهداف من دقائق (رقم) إلى وقت نصّي HH:MM — آمن، يحفظ القيم (150 → "2:30")
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='clinic_physio' AND table_name='treatment_goals' AND column_name='standLongerMinutes') THEN
    ALTER TABLE "clinic_physio"."treatment_goals" RENAME COLUMN "standLongerMinutes" TO "standLonger";
    ALTER TABLE "clinic_physio"."treatment_goals" ALTER COLUMN "standLonger" TYPE TEXT
      USING (CASE WHEN "standLonger" IS NULL THEN NULL ELSE (("standLonger"/60)::text || ':' || lpad(("standLonger"%60)::text,2,'0')) END);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='clinic_physio' AND table_name='treatment_goals' AND column_name='sleepLongerMinutes') THEN
    ALTER TABLE "clinic_physio"."treatment_goals" RENAME COLUMN "sleepLongerMinutes" TO "sleepLonger";
    ALTER TABLE "clinic_physio"."treatment_goals" ALTER COLUMN "sleepLonger" TYPE TEXT
      USING (CASE WHEN "sleepLonger" IS NULL THEN NULL ELSE (("sleepLonger"/60)::text || ':' || lpad(("sleepLonger"%60)::text,2,'0')) END);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='clinic_physio' AND table_name='treatment_goals' AND column_name='sitLongerMinutes') THEN
    ALTER TABLE "clinic_physio"."treatment_goals" RENAME COLUMN "sitLongerMinutes" TO "sitLonger";
    ALTER TABLE "clinic_physio"."treatment_goals" ALTER COLUMN "sitLonger" TYPE TEXT
      USING (CASE WHEN "sitLonger" IS NULL THEN NULL ELSE (("sitLonger"/60)::text || ':' || lpad(("sitLonger"%60)::text,2,'0')) END);
  END IF;
END $$;
