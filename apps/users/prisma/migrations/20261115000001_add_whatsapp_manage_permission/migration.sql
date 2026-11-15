-- صلاحية إدارة خدمة واتساب (حالة الاتصال/QR/تسجيل خروج) — إدراج فقط، بدون تعديل أو حذف
-- أي صلاحية قائمة
INSERT INTO users.permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'whatsapp.manage', 'إدارة ربط واتساب', 'View WhatsApp connection status/QR and log out the linked number', 'whatsapp', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- تُمنح لـsuper_admin فقط
INSERT INTO users.role_permissions ("roleId", "permissionId", "assignedAt")
SELECT r.id, p.id, NOW()
FROM users.roles r
CROSS JOIN users.permissions p
WHERE r.name = 'super_admin'
  AND p.name = 'whatsapp.manage'
ON CONFLICT DO NOTHING;
