-- حقل نص لخيار "آخر Other" في قائمة الأمراض المزمنة — إضافي بحت، آمن
ALTER TABLE "clinic_physio"."medical_histories" ADD COLUMN IF NOT EXISTS "chronicConditionsOther" TEXT;
