-- ============================================================
-- Migration: Add requests service permissions
-- ============================================================
SET search_path TO users;

INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'requests:approve',          'الموافقة على الطلبات',    'Approve approval steps',            'requests', NOW(), NOW()),
  (gen_random_uuid()::text, 'requests:reject',           'رفض الطلبات',             'Reject approval steps',             'requests', NOW(), NOW()),
  (gen_random_uuid()::text, 'requests:ceo-approve',      'موافقة المدير التنفيذي',  'Approve requests as CEO',           'requests', NOW(), NOW()),
  (gen_random_uuid()::text, 'requests:cfo-approve',      'موافقة المدير المالي',    'Approve requests as CFO',           'requests', NOW(), NOW()),
  (gen_random_uuid()::text, 'requests:hr-approve',       'موافقة الموارد البشرية',  'Approve requests as HR',            'requests', NOW(), NOW()),
  (gen_random_uuid()::text, 'requests:read-all-steps',   'عرض خطوات الموافقة',     'View all approval steps',           'requests', NOW(), NOW()),
  (gen_random_uuid()::text, 'requests:manage-workflows', 'إدارة سير العمل',         'Manage approval workflow configs',  'requests', NOW(), NOW())
ON CONFLICT DO NOTHING;
