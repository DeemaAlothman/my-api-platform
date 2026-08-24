SET search_path TO users;

-- ── payroll.advances.* ─────────────────────────────────────────────────────
INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt") VALUES
  (gen_random_uuid()::text, 'payroll.advances.read',   'عرض السُلف',    'عرض قائمة السُلف الراتب',           'payroll', NOW(), NOW()),
  (gen_random_uuid()::text, 'payroll.advances.create', 'إنشاء سلفة',   'إنشاء طلب سلفة راتب جديد',          'payroll', NOW(), NOW()),
  (gen_random_uuid()::text, 'payroll.advances.update', 'تعديل سلفة',   'تعديل بيانات سلفة قائمة',           'payroll', NOW(), NOW()),
  (gen_random_uuid()::text, 'payroll.advances.cancel', 'إلغاء سلفة',   'إلغاء طلب سلفة',                   'payroll', NOW(), NOW()),
  (gen_random_uuid()::text, 'payroll.advances.delete', 'حذف سلفة',     'حذف سلفة بشكل نهائي',              'payroll', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- ── payroll.commissions.* ──────────────────────────────────────────────────
INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt") VALUES
  (gen_random_uuid()::text, 'payroll.commissions.read',    'عرض العمولات',    'عرض قائمة عمولات المبيعات',        'payroll', NOW(), NOW()),
  (gen_random_uuid()::text, 'payroll.commissions.create',  'إنشاء عمولة',    'إضافة عمولة مبيعات جديدة',         'payroll', NOW(), NOW()),
  (gen_random_uuid()::text, 'payroll.commissions.update',  'تعديل عمولة',    'تعديل بيانات عمولة قائمة',         'payroll', NOW(), NOW()),
  (gen_random_uuid()::text, 'payroll.commissions.confirm', 'اعتماد عمولة',   'اعتماد عمولة وإدراجها في الراتب',  'payroll', NOW(), NOW()),
  (gen_random_uuid()::text, 'payroll.commissions.delete',  'حذف عمولة',      'حذف عمولة بشكل نهائي',             'payroll', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- ── onboarding.* ───────────────────────────────────────────────────────────
INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt") VALUES
  (gen_random_uuid()::text, 'onboarding.manage',      'إدارة التعيين',       'إنشاء وحذف قوالب ومسارات التعيين',     'onboarding', NOW(), NOW()),
  (gen_random_uuid()::text, 'onboarding.view',        'عرض التعيين',         'عرض قوالب ومسارات التعيين',             'onboarding', NOW(), NOW()),
  (gen_random_uuid()::text, 'onboarding.update_task', 'تحديث مهمة تعيين',   'تحديث حالة مهمة في مسار التعيين',      'onboarding', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- إسناد onboarding.manage + onboarding.view لكل دور عنده employees:read (=صلاحية HR)
INSERT INTO role_permissions ("roleId", "permissionId")
SELECT DISTINCT rp."roleId", p.id
FROM role_permissions rp
JOIN permissions src ON src.id = rp."permissionId" AND src.name = 'employees:read'
CROSS JOIN permissions p WHERE p.name IN ('onboarding.manage', 'onboarding.view')
ON CONFLICT DO NOTHING;

-- إسناد onboarding.update_task لدور الموظف
INSERT INTO role_permissions ("roleId", "permissionId")
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'employee'
  AND p.name = 'onboarding.update_task'
ON CONFLICT DO NOTHING;
