-- اختيار متعدد لأخصائيي العلاج الفيزيائي على الحالة — إضافي بحت، آمن
ALTER TABLE "clinic_physio"."physio_cases" ADD COLUMN IF NOT EXISTS "physiotherapistIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
