-- Add permissions for the new Patient App service (exercise library, taxonomy, session assignments)

SET search_path TO users;

INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'clinic.patient_app.account.manage',          'إدارة حساب تطبيق المريض',   'Manage patient app account',             'clinic_patient_app', NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.patient_app.taxonomy.manage',         'إدارة تصنيف التمارين',       'Manage exercise taxonomy',               'clinic_patient_app', NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.patient_app.exercise_library.manage', 'إدارة مكتبة التمارين',       'Manage exercise library',                'clinic_patient_app', NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.patient_app.assignment.create',       'إسناد تمرين لجلسة',          'Create session exercise assignment',     'clinic_patient_app', NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.patient_app.assignment.edit',         'تعديل تمرين مُسند',          'Edit session exercise assignment',       'clinic_patient_app', NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.patient_app.assignment.cancel',       'إلغاء تمرين مُسند',          'Cancel session exercise assignment',     'clinic_patient_app', NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.patient_app.execution.view',          'عرض تنفيذ التمارين',         'View patient exercise execution',        'clinic_patient_app', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Grant full access to super_admin and clinic department head
INSERT INTO role_permissions ("roleId", "permissionId", "assignedAt")
SELECT r.id, p.id, NOW()
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('super_admin', 'clinic_dept_head')
  AND p.module = 'clinic_patient_app'
ON CONFLICT DO NOTHING;

-- Therapists: assign/edit/cancel/view execution (not taxonomy/library management)
INSERT INTO role_permissions ("roleId", "permissionId", "assignedAt")
SELECT r.id, p.id, NOW()
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'clinic_physiotherapist'
  AND p.name IN (
    'clinic.patient_app.account.manage',
    'clinic.patient_app.assignment.create',
    'clinic.patient_app.assignment.edit',
    'clinic.patient_app.assignment.cancel',
    'clinic.patient_app.execution.view'
  )
ON CONFLICT DO NOTHING;
