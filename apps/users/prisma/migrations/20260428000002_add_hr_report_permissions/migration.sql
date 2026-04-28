-- Phase 2: Add new permissions for manager notes, HR reports, and hiring PDF

SET search_path TO users;

INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'employees:manager-notes:read',    'قراءة ملاحظات المديرين',       'Read manager notes on employee profile',    'employees', NOW(), NOW()),
  (gen_random_uuid()::text, 'employees:manager-notes:write',   'كتابة ملاحظات المديرين',       'Write/update manager notes on employee',    'employees', NOW(), NOW()),
  (gen_random_uuid()::text, 'employees:probation-report:read', 'تقرير اقتراب انتهاء التجربة', 'View probation ending soon report',         'employees', NOW(), NOW()),
  (gen_random_uuid()::text, 'employees:contract-report:read',  'تقرير اقتراب انتهاء العقد',   'View contract ending soon report',          'employees', NOW(), NOW()),
  (gen_random_uuid()::text, 'requests:hiring:complete',        'إتمام طلب التوظيف',           'Upload hiring contract PDF to complete',     'requests',  NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Assign manager-notes permissions to super_admin, hr_manager, manager roles
INSERT INTO role_permissions ("roleId", "permissionId", "assignedAt")
SELECT r.id, p.id, NOW()
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('super_admin', 'hr_manager', 'manager')
  AND p.name IN ('employees:manager-notes:read', 'employees:manager-notes:write')
ON CONFLICT DO NOTHING;

-- Assign report permissions to super_admin, hr_manager
INSERT INTO role_permissions ("roleId", "permissionId", "assignedAt")
SELECT r.id, p.id, NOW()
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('super_admin', 'hr_manager')
  AND p.name IN ('employees:probation-report:read', 'employees:contract-report:read', 'requests:hiring:complete')
ON CONFLICT DO NOTHING;
