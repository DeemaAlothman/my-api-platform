-- صلاحيات نظام الصندوق النقدي الجديد — إدراج فقط، بدون تعديل أو حذف أي صلاحية قائمة
INSERT INTO users.permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'cashbox.boxes.read',          'عرض الصناديق النقدية',           'View cash boxes and balances',          'cashbox', NOW(), NOW()),
  (gen_random_uuid(), 'cashbox.boxes.manage',        'إدارة الصناديق النقدية',         'Create/update cash boxes, set main box', 'cashbox', NOW(), NOW()),
  (gen_random_uuid(), 'cashbox.transactions.read',   'عرض حركات الصندوق',              'View cashbox transactions',              'cashbox', NOW(), NOW()),
  (gen_random_uuid(), 'cashbox.transactions.create', 'تنفيذ حركات الصندوق',            'Create cashbox transactions (disbursement/receipt/handover/refill)', 'cashbox', NOW(), NOW()),
  (gen_random_uuid(), 'cashbox.counts.read',         'عرض جرد الصناديق',               'View cashbox counts',                    'cashbox', NOW(), NOW()),
  (gen_random_uuid(), 'cashbox.counts.create',       'تسجيل جرد صندوق',                'Create cashbox counts',                  'cashbox', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- منح الصلاحيات كلها لـsuper_admin فقط — باقي الأدوار (أمين صندوق، مدير مالي، إلخ)
-- لازم تُسند يدوياً من لوحة الإدارة
INSERT INTO users.role_permissions ("roleId", "permissionId", "assignedAt")
SELECT r.id, p.id, NOW()
FROM users.roles r
CROSS JOIN users.permissions p
WHERE r.name = 'super_admin'
  AND p.module = 'cashbox'
ON CONFLICT DO NOTHING;
