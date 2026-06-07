SET search_path TO users;

-- صلاحية جديدة: عرض عهدتي (custody read own) — لـ GET /custodies/my
INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'custodies:read_own', 'عرض عهدتي', 'View own custody', 'custodies', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- منح الصلاحية لكل الأدوار الحالية للحفاظ على الوصول القائم
-- (كان /custodies/my مفتوحاً لأي مستخدم مسجّل الدخول). تبقى قابلة للتحكم لاحقاً من شاشة الصلاحيات.
INSERT INTO role_permissions ("roleId", "permissionId")
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.name = 'custodies:read_own'
ON CONFLICT DO NOTHING;
