INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'attendance.records.read-team', 'عرض بصمات الموظفين التابعين لي', 'View attendance records of direct subordinates only', 'attendance', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'attendance.records.read-team');
