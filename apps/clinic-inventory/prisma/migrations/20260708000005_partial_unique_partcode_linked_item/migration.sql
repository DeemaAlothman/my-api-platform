-- إزالة الـ unique constraint الكامل على partCode
DROP INDEX IF EXISTS "clinic_inventory"."inventory_items_partCode_key";

-- إنشاء unique جزئي: فقط الأصناف الحقيقية (status IS NULL) يجب أن يكون partCode فريداً
-- الطلبات (status = PENDING) تقدر تشارك نفس الكود مع الصنف الأصلي
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_partCode_real_unique"
  ON clinic_inventory.inventory_items("partCode")
  WHERE "status" IS NULL;

-- حقل للربط بالصنف الأصلي (لما الطلب يتعلق بصنف موجود)
ALTER TABLE clinic_inventory.inventory_items
  ADD COLUMN IF NOT EXISTS "linkedInventoryItemId" TEXT;

-- index للبحث السريع بالحالة
CREATE INDEX IF NOT EXISTS "inventory_items_status_idx"
  ON clinic_inventory.inventory_items("status");
