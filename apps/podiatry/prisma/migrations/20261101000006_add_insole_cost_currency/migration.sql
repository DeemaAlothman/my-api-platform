-- عملة تكلفة الضبان (USD | SYP) — إضافة عمود نصي اختياري فقط.
-- القيم المسجَّلة سابقاً تبقى بعملة NULL عن قصد: لا ترحيل تلقائي.
ALTER TABLE "clinic_podiatry"."podiatry_sessions"
  ADD COLUMN IF NOT EXISTS "insoleCostCurrency" TEXT;
