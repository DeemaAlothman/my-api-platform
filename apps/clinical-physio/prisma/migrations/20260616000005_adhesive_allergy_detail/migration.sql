-- حقل تفصيل سؤال حساسية اللاصق/اللاتكس/النحل («إذا نعم يرجى ذكر») — إضافي بحت، آمن
ALTER TABLE "clinic_physio"."medical_histories" ADD COLUMN IF NOT EXISTS "adhesiveAllergyDetail" TEXT;
