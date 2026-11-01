-- صلاحية "تنبيه رئيس القسم بخصوص استمارة غير مكتملة" — إدراج فقط، بدون تعديل أو حذف أي صلاحية قائمة
INSERT INTO users.permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'clinic.physio.notify_incomplete_form',      'تنبيه رئيس قسم العلاج الفيزيائي (استمارة غير مكتملة)',      'Notify physio department head about an incomplete form',      'clinic_physio',      NOW(), NOW()),
  (gen_random_uuid(), 'clinic.prosthetics.notify_incomplete_form', 'تنبيه رئيس قسم الأطراف الصناعية (استمارة غير مكتملة)',      'Notify prosthetics department head about an incomplete form', 'clinic_prosthetics', NOW(), NOW()),
  (gen_random_uuid(), 'clinic.podiatry.notify_incomplete_form',    'تنبيه رئيس قسم طب الأقدام (استمارة غير مكتملة)',             'Notify podiatry department head about an incomplete form',    'clinic_podiatry',    NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- منح الصلاحية: المدير الطبي + super_admin فقط
INSERT INTO users.role_permissions ("roleId", "permissionId", "assignedAt")
SELECT r.id, p.id, NOW()
FROM users.roles r
CROSS JOIN users.permissions p
WHERE r.name IN ('super_admin', 'clinic_medical_director')
  AND p.name IN (
    'clinic.physio.notify_incomplete_form',
    'clinic.prosthetics.notify_incomplete_form',
    'clinic.podiatry.notify_incomplete_form'
  )
ON CONFLICT DO NOTHING;
