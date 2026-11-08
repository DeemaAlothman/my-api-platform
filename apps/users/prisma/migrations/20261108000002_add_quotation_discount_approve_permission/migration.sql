-- صلاحية موافقة المدير التنفيذي على خصم عروض الأسعار — إدراج فقط، بدون تعديل أو حذف أي
-- صلاحية قائمة
INSERT INTO users.permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'warehouse.quotations.approve_discount', 'موافقة المدير التنفيذي على خصم عرض السعر', 'CEO approval for a quotation discount', 'warehouse', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- منح الصلاحية لـsuper_admin + دور CEO
INSERT INTO users.role_permissions ("roleId", "permissionId", "assignedAt")
SELECT r.id, p.id, NOW()
FROM users.roles r
CROSS JOIN users.permissions p
WHERE r.name IN ('super_admin', 'CEO')
  AND p.name = 'warehouse.quotations.approve_discount'
ON CONFLICT DO NOTHING;
