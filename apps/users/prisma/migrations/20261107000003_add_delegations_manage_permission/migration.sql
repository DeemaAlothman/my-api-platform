-- صلاحية إدارة التفويضات (عرض الكل + إلغاء يدوي) — إدراج فقط، بدون تعديل أو حذف أي صلاحية قائمة
INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'delegations.manage', 'إدارة التفويضات المؤقتة', 'View and manually revoke temporary delegations', 'delegations', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- منح الصلاحية: super_admin + مدير الموارد البشرية
INSERT INTO role_permissions ("roleId", "permissionId", "assignedAt")
SELECT r.id, p.id, NOW()
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('super_admin', 'hr_manager')
  AND p.name = 'delegations.manage'
ON CONFLICT DO NOTHING;
