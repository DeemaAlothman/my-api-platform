-- ⚠️ تشغيله على السيرفر فقط بعد التحقق
-- يحذف role_permissions للأدوار المحذوفة (soft-deleted)
-- الأدوار نفسها تبقى (deletedAt محفوظ)

-- ─── خطوة 1: تحقق أن لا يوجد مستخدم مرتبط بهذه الأدوار ─────────────────
SELECT COUNT(*) as active_assignments
FROM users.user_roles
WHERE "roleId" IN (
  SELECT id FROM users.roles WHERE "deletedAt" IS NOT NULL
);
-- إذا النتيجة 0 → استمر | إذا > 0 → توقف وراجع

-- ─── خطوة 2: backup قبل الحذف ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users.role_permissions_deleted_backup AS
SELECT rp.* FROM users.role_permissions rp
INNER JOIN users.roles r ON r.id = rp."roleId"
WHERE r."deletedAt" IS NOT NULL;

-- ─── خطوة 3: حذف role_permissions فقط ──────────────────────────────────
DELETE FROM users.role_permissions
WHERE "roleId" IN (
  SELECT id FROM users.roles WHERE "deletedAt" IS NOT NULL
);

-- ─── تحقق بعد الحذف ─────────────────────────────────────────────────────
SELECT
  r.name,
  r."deletedAt",
  COUNT(rp."roleId") as remaining_permissions
FROM users.roles r
LEFT JOIN users.role_permissions rp ON rp."roleId" = r.id
WHERE r."deletedAt" IS NOT NULL
GROUP BY r.id, r.name, r."deletedAt";
-- يجب أن يكون remaining_permissions = 0 لكل الصفوف
