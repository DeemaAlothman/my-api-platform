-- Add a dedicated Physiotherapy Department Head role (separate from the generic clinic_dept_head,
-- which spans every clinical department) so confidential therapist ratings can be restricted
-- exclusively to it, per the patient-app spec (section 12/13).

SET search_path TO users;

INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'clinic.patient_app.chat.use',     'استخدام محادثة المريض',     'Use patient chat as responsible therapist', 'clinic_patient_app', NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.patient_app.ratings.view', 'عرض تقييمات المعالجين',     'View confidential therapist ratings',       'clinic_patient_app', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

INSERT INTO roles (id, name, "displayNameAr", "displayNameEn", description, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'clinic_physio_dept_head',
  'رئيس قسم العلاج الفيزيائي',
  'Physiotherapy Department Head',
  'صلاحية حصرية لعرض تقييمات مرضى العلاج الفيزيائي السرية للمعالجين',
  NOW(), NOW()
)
ON CONFLICT (name) DO NOTHING;

-- عرض التقييمات: حصراً رئيس قسم الفيزيو + super_admin (وليس clinic_dept_head العام لكل الأقسام)
INSERT INTO role_permissions ("roleId", "permissionId", "assignedAt")
SELECT r.id, p.id, NOW()
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('super_admin', 'clinic_physio_dept_head')
  AND p.name = 'clinic.patient_app.ratings.view'
ON CONFLICT DO NOTHING;

-- استخدام الشات: المعالج الفيزيائي نفسه (مع مرضاه المسندين) + رئيس القسم + super_admin
INSERT INTO role_permissions ("roleId", "permissionId", "assignedAt")
SELECT r.id, p.id, NOW()
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('super_admin', 'clinic_physio_dept_head', 'clinic_physiotherapist')
  AND p.name = 'clinic.patient_app.chat.use'
ON CONFLICT DO NOTHING;
