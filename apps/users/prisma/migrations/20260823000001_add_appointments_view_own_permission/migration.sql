SET search_path TO users;

-- إضافة صلاحية عرض المواعيد الشخصية
INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'clinic.appointments.view_own',
  'عرض مواعيدي',
  'يسمح للمستخدم برؤية مواعيده الشخصية فقط في العيادة',
  'clinic_appointments',
  NOW(), NOW()
)
ON CONFLICT (name) DO NOTHING;

-- إسناد الصلاحية لكل دور عنده clinic.appointments.view
INSERT INTO role_permissions ("roleId", "permissionId")
SELECT r.id, p.id
FROM roles r
JOIN role_permissions rp ON rp."roleId" = r.id
JOIN permissions src ON src.id = rp."permissionId" AND src.name = 'clinic.appointments.view'
JOIN permissions p ON p.name = 'clinic.appointments.view_own'
ON CONFLICT DO NOTHING;

-- إسناد الصلاحية لدور الموظف إن وُجد
INSERT INTO role_permissions ("roleId", "permissionId")
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'employee'
  AND p.name = 'clinic.appointments.view_own'
ON CONFLICT DO NOTHING;
