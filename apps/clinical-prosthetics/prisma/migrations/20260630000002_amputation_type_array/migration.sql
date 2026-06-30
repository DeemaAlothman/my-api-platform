-- amputationType يصير مصفوفة بدل قيمة واحدة — يسمح بإرسال UPPER وLOWER سوا لنفس الحالة
-- يحوّل كل قيمة موجودة لمصفوفة من عنصر واحد، وأي NULL يصير مصفوفة فاضية — صفر فقدان بيانات

ALTER TABLE "clinic_prosthetics"."prosthetics_cases"
  ALTER COLUMN "amputationType" DROP NOT NULL;

ALTER TABLE "clinic_prosthetics"."prosthetics_cases"
  ALTER COLUMN "amputationType" DROP DEFAULT;

ALTER TABLE "clinic_prosthetics"."prosthetics_cases"
  ALTER COLUMN "amputationType" TYPE "clinic_prosthetics"."AmputationType"[]
  USING (
    CASE WHEN "amputationType" IS NULL
      THEN ARRAY[]::"clinic_prosthetics"."AmputationType"[]
      ELSE ARRAY["amputationType"]::"clinic_prosthetics"."AmputationType"[]
    END
  );

ALTER TABLE "clinic_prosthetics"."prosthetics_cases"
  ALTER COLUMN "amputationType" SET DEFAULT ARRAY[]::"clinic_prosthetics"."AmputationType"[];
