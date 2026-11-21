-- موظفو خارج الشركة (استشاري طبي، استشاري تقني، محامٍ…).
--
-- النوع في جدول مرجعي لا في enum، كي تُضاف أنواع جديدة من الواجهة بلا migration.
--
-- إضافة فقط: جدول جديد + عمودان على الموظفين، أحدهما بقيمة افتراضية false
-- والآخر يقبل NULL. صفر تعديل وصفر حذف لأي موظف قائم — كل الموظفين الحاليين
-- يصيرون isExternal = false وهو الصحيح.

CREATE TABLE IF NOT EXISTS "external_employee_types" (
  "id"        TEXT NOT NULL,
  "nameAr"    TEXT NOT NULL,
  "nameEn"    TEXT,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "external_employee_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "external_employee_types_nameAr_key"
  ON "external_employee_types" ("nameAr");

-- الأنواع المذكورة في الطلب. ON CONFLICT يجعل إعادة التنفيذ بلا أثر.
INSERT INTO "external_employee_types" ("id", "nameAr", "nameEn", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'استشاري طبي', 'Medical Consultant',   NOW(), NOW()),
  (gen_random_uuid(), 'استشاري تقني', 'Technical Consultant', NOW(), NOW()),
  (gen_random_uuid(), 'محامٍ',        'Lawyer',               NOW(), NOW())
ON CONFLICT ("nameAr") DO NOTHING;

ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "isExternal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "externalTypeId" TEXT;

CREATE INDEX IF NOT EXISTS "employees_isExternal_idx" ON "employees" ("isExternal");

DO $$
BEGIN
  ALTER TABLE "employees"
    ADD CONSTRAINT "employees_externalTypeId_fkey"
    FOREIGN KEY ("externalTypeId") REFERENCES "external_employee_types"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
