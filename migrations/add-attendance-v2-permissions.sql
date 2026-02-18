-- ============================================================
-- Migration: Add Employee Schedules + Justifications Permissions
-- Safe to run on existing production server (no data loss)
-- Date: 2026-02-16
-- ============================================================

-- 1. Add missing permissions (ON CONFLICT DO NOTHING = safe to re-run)
INSERT INTO users.permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  -- Employee Schedules
  (gen_random_uuid(), 'attendance.employee-schedules.read',   'عرض جداول الموظفين',      'Read employee schedule assignments', 'attendance', NOW(), NOW()),
  (gen_random_uuid(), 'attendance.employee-schedules.create', 'إنشاء جدول موظف',          'Create employee schedule assignment', 'attendance', NOW(), NOW()),
  (gen_random_uuid(), 'attendance.employee-schedules.update', 'تعديل جدول موظف',          'Update employee schedule assignment', 'attendance', NOW(), NOW()),
  (gen_random_uuid(), 'attendance.employee-schedules.delete', 'حذف جدول موظف',            'Delete employee schedule assignment', 'attendance', NOW(), NOW()),
  -- Attendance Justifications
  (gen_random_uuid(), 'attendance.justifications.read',           'عرض تبريرات الحضور',       'Read all attendance justifications', 'attendance', NOW(), NOW()),
  (gen_random_uuid(), 'attendance.justifications.read-own',       'عرض تبريراتي الخاصة',      'Read own attendance justifications', 'attendance', NOW(), NOW()),
  (gen_random_uuid(), 'attendance.justifications.create-own',     'تقديم تبرير حضور',         'Submit own attendance justification', 'attendance', NOW(), NOW()),
  (gen_random_uuid(), 'attendance.justifications.manager-review', 'مراجعة المدير للتبريرات',  'Manager review of justifications', 'attendance', NOW(), NOW()),
  (gen_random_uuid(), 'attendance.justifications.hr-review',      'مراجعة HR للتبريرات',      'HR review of justifications', 'attendance', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- 2. Assign ALL new permissions to super_admin role (safe to re-run)
INSERT INTO users.role_permissions ("roleId", "permissionId", "assignedAt")
SELECT r.id, p.id, NOW()
FROM users.roles r, users.permissions p
WHERE r.name = 'super_admin'
  AND p.name IN (
    'attendance.employee-schedules.read',
    'attendance.employee-schedules.create',
    'attendance.employee-schedules.update',
    'attendance.employee-schedules.delete',
    'attendance.justifications.read',
    'attendance.justifications.read-own',
    'attendance.justifications.create-own',
    'attendance.justifications.manager-review',
    'attendance.justifications.hr-review'
  )
ON CONFLICT DO NOTHING;

-- 3. Verify (optional check)
SELECT name FROM users.permissions
WHERE name LIKE 'attendance.employee-schedules.%'
   OR name LIKE 'attendance.justifications.%'
ORDER BY name;
