-- هل خضعت لأي عمليات جراحية؟ (نعم/لا) + تفصيل — على السجل الطبي. إضافي بحت، آمن.
ALTER TABLE "clinic_physio"."medical_histories" ADD COLUMN IF NOT EXISTS "hadSurgeries" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clinic_physio"."medical_histories" ADD COLUMN IF NOT EXISTS "surgeriesDetail" TEXT;
