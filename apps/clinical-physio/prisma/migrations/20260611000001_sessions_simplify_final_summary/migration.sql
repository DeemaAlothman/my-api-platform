-- (أ) رقم الجلسة + جعل physiotherapistId اختياري (إضافي/آمن، الأعمدة الأخرى تبقى كما هي)
ALTER TABLE "clinic_physio"."physio_sessions" ADD COLUMN IF NOT EXISTS "sessionNumber" INTEGER;
ALTER TABLE "clinic_physio"."physio_sessions" ALTER COLUMN "physiotherapistId" DROP NOT NULL;

-- ترقيم الجلسات الموجودة تسلسلياً لكل حالة (حسب التاريخ ثم id)
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "caseId" ORDER BY "sessionDate", id) AS rn
  FROM "clinic_physio"."physio_sessions"
)
UPDATE "clinic_physio"."physio_sessions" s
SET "sessionNumber" = n.rn
FROM numbered n
WHERE n.id = s.id AND s."sessionNumber" IS NULL;

-- (ب) الملخص النهائي على الحالة
ALTER TABLE "clinic_physio"."physio_cases" ADD COLUMN IF NOT EXISTS "finalSummary" TEXT;
