-- صلاحيات عملاء المبيعات (/referrals/customers) وتسعير الأطراف الصناعية (/warehouse/pricing/prosthetics)
-- كانت مضافة فقط بملف الثوابت المشترك بدون صفّها فعلياً بجدول الصلاحيات — إدراج فقط، بدون
-- تعديل أو حذف أي صلاحية قائمة
INSERT INTO users.permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'sales.customers.view',               'عرض عملاء المبيعات',                    'View sales customers',                         'sales',     NOW(), NOW()),
  (gen_random_uuid(), 'sales.customers.manage',             'إضافة/تعديل/حذف عملاء المبيعات',         'Create/update/delete sales customers',         'sales',     NOW(), NOW()),
  (gen_random_uuid(), 'warehouse.pricing.prosthetics.view',   'عرض تسعير قطع الأطراف الصناعية',       'View prosthetics parts pricing',               'warehouse', NOW(), NOW()),
  (gen_random_uuid(), 'warehouse.pricing.prosthetics.manage', 'تعديل تسعير قطع الأطراف الصناعية',     'Manage prosthetics parts pricing (markup)',    'warehouse', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- منح الصلاحيات الأربع لـsuper_admin فقط (الأدوار التانية — قسم المبيعات، المدير المالي،
-- إلخ — لازم تُسند يدوياً من لوحة الإدارة متل أي صلاحية جديدة)
INSERT INTO users.role_permissions ("roleId", "permissionId", "assignedAt")
SELECT r.id, p.id, NOW()
FROM users.roles r
CROSS JOIN users.permissions p
WHERE r.name = 'super_admin'
  AND p.name IN (
    'sales.customers.view',
    'sales.customers.manage',
    'warehouse.pricing.prosthetics.view',
    'warehouse.pricing.prosthetics.manage'
  )
ON CONFLICT DO NOTHING;
