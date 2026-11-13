-- فصل صلاحية كتابة رأي الطبيب عن رأي رئيس القسم وعن التوقيع — إدراج فقط، بدون تعديل أو حذف
-- أي صلاحية قائمة
INSERT INTO users.permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'clinic.physio.doctor_review', 'كتابة رأي الطبيب', 'Write physio doctor review (separate from plan sign)', 'clinic_physio', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- تُمنح لـsuper_admin فقط — الطبيب المشرف/المدير الطبي لازم تُسند لدورهم الفعلي يدوياً من لوحة الإدارة
INSERT INTO users.role_permissions ("roleId", "permissionId", "assignedAt")
SELECT r.id, p.id, NOW()
FROM users.roles r
CROSS JOIN users.permissions p
WHERE r.name = 'super_admin'
  AND p.name = 'clinic.physio.doctor_review'
ON CONFLICT DO NOTHING;
