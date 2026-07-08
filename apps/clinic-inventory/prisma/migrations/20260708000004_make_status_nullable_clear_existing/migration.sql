-- إزالة الـ DEFAULT وجعل الحقل nullable
-- الأصناف العادية (التي أضافها المسؤول مباشرة) لا تحتاج حالة طلب
ALTER TABLE clinic_inventory.inventory_items
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" DROP NOT NULL;

-- تصفير الحالة للأصناف التي لم يطلبها فني (requestedByUserId = null)
UPDATE clinic_inventory.inventory_items
SET "status" = NULL
WHERE "requestedByUserId" IS NULL;
