-- رأي رئيس القسم + قرار الطبيب لكل جلسة (إضافي بحت، آمن)
ALTER TABLE "clinic_physio"."physio_sessions" ADD COLUMN IF NOT EXISTS "supervisorOpinion" TEXT;
ALTER TABLE "clinic_physio"."physio_sessions" ADD COLUMN IF NOT EXISTS "doctorDecision" TEXT;
