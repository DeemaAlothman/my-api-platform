-- Phase 3: Add create-manual and update-manual permissions
-- Safe: only INSERT, no DELETE, no UPDATE on existing data
-- Run on: users DB (not attendance DB)

BEGIN;

-- 1. Add new permissions (skip if already exist)
INSERT INTO permissions (id, name, "displayName", module, "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'attendance.records.create-manual', 'تسجيل يدوي للحضور', 'attendance', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'attendance.records.create-manual');

INSERT INTO permissions (id, name, "displayName", module, "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'attendance.records.update-manual', 'تعديل يدوي للحضور', 'attendance', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'attendance.records.update-manual');

-- 2. Assign create-manual to every role that has attendance.records.create
INSERT INTO role_permissions ("roleId", "permissionId", "assignedAt")
SELECT rp."roleId", new_p.id, NOW()
FROM role_permissions rp
JOIN permissions old_p ON old_p.id = rp."permissionId" AND old_p.name = 'attendance.records.create'
JOIN permissions new_p ON new_p.name = 'attendance.records.create-manual'
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions
  WHERE "roleId" = rp."roleId" AND "permissionId" = new_p.id
);

-- 3. Assign update-manual to every role that has attendance.records.update
INSERT INTO role_permissions ("roleId", "permissionId", "assignedAt")
SELECT rp."roleId", new_p.id, NOW()
FROM role_permissions rp
JOIN permissions old_p ON old_p.id = rp."permissionId" AND old_p.name = 'attendance.records.update'
JOIN permissions new_p ON new_p.name = 'attendance.records.update-manual'
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions
  WHERE "roleId" = rp."roleId" AND "permissionId" = new_p.id
);

COMMIT;

-- Verify
SELECT name, "displayName" FROM permissions
WHERE name IN ('attendance.records.create-manual', 'attendance.records.update-manual');
