-- لون نوع "أخرى" بخريطة الألم (يحدّده الفرونت) — إضافي بحت، آمن
ALTER TABLE "clinic_physio"."physio_cases" ADD COLUMN IF NOT EXISTS "painTypeOtherColor" TEXT;
