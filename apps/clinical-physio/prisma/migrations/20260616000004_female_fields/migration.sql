-- حقول خاصة بالإناث على السجل الطبي — إضافي بحت، آمن
ALTER TABLE "clinic_physio"."medical_histories" ADD COLUMN IF NOT EXISTS "maritalStatus" TEXT;
ALTER TABLE "clinic_physio"."medical_histories" ADD COLUMN IF NOT EXISTS "lastMenstrualPeriod" TEXT;
