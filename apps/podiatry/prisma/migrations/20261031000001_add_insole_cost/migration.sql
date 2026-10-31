-- تكلفة الضبان على مستوى الجلسة (التركيب) — إضافة عمود اختياري فقط، بدون أي مساس بالبيانات القائمة
ALTER TABLE "clinic_podiatry"."podiatry_sessions"
  ADD COLUMN IF NOT EXISTS "insoleCost" DECIMAL(12,2);
