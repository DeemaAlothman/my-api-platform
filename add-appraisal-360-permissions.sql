-- تقييم 360 — صلاحيات جديدة. إضافة فقط (ON CONFLICT DO NOTHING + NOT EXISTS) — لا حذف ولا تعديل.
-- يُنفَّذ يدوياً على السيرفر وقت النشر فقط.

INSERT INTO users.permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  ('eval-360-manage', 'evaluation:appraisal:manage', 'إدارة تقييم 360',
   'إنشاء الدورات وفتحها وإغلاقها، تصنيف الأقسام، الحساب واستعراض النتائج', 'evaluation', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('eval-360-raters', 'evaluation:appraisal:view-raters', 'تدقيق مقيّمي 360',
   'رؤية أسماء مقيّمي الزملاء والمرؤوسين (للتدقيق فقط)', 'evaluation', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- ربط بـ super_admin فقط — إسنادها لدور HR يتم من الشاشة
INSERT INTO users.role_permissions ("roleId", "permissionId", "assignedAt")
SELECT r.id, p.id, CURRENT_TIMESTAMP
FROM users.roles r, users.permissions p
WHERE r.name = 'super_admin'
  AND p.name IN ('evaluation:appraisal:manage', 'evaluation:appraisal:view-raters')
  AND NOT EXISTS (
    SELECT 1 FROM users.role_permissions rp WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
  );

SELECT name FROM users.permissions WHERE name LIKE 'evaluation:appraisal:%';
