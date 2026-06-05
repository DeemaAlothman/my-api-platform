SET search_path TO users;

-- New permissions: split consent/note creation + physio supervisor review
INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'clinic.patients.create_consents', 'إنشاء موافقات المريض', 'Create patient consents', 'clinic_patients', NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.patients.create_notes',    'إنشاء ملاحظات المريض', 'Create patient notes',    'clinic_patients', NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.physio.supervisor_review', 'مراجعة رئيس القسم',     'Physio supervisor review','clinic_physio',   NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Bind to roles (preserve prior access):
--   create_consents → roles that previously had view_consents
--   create_notes    → roles that previously had patients.view
--   supervisor_review → clinic_dept_head, supervising_doctor, medical_director
INSERT INTO role_permissions ("roleId", "permissionId")
SELECT r.id, p.id
FROM roles r
JOIN role_permissions rp ON rp."roleId" = r.id
JOIN permissions src ON src.id = rp."permissionId" AND src.name = 'clinic.patients.view_consents'
JOIN permissions p ON p.name = 'clinic.patients.create_consents'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions ("roleId", "permissionId")
SELECT r.id, p.id
FROM roles r
JOIN role_permissions rp ON rp."roleId" = r.id
JOIN permissions src ON src.id = rp."permissionId" AND src.name = 'clinic.patients.view'
JOIN permissions p ON p.name = 'clinic.patients.create_notes'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions ("roleId", "permissionId")
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('clinic_dept_head', 'clinic_supervising_doctor', 'clinic_medical_director')
  AND p.name = 'clinic.physio.supervisor_review'
ON CONFLICT DO NOTHING;
