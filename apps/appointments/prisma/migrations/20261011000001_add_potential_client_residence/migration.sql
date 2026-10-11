-- العملاء المحتملين: مكان الإقامة — عمود جديد اختياري فقط، لا يتغير أي سجل موجود
ALTER TABLE "clinic_appointments"."potential_clients" ADD COLUMN IF NOT EXISTS "residence" TEXT;
