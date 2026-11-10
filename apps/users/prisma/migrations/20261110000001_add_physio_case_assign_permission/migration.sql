-- صلاحية تعيين معالج لحالة علاج فيزيائي بانتظار التعيين — إدراج فقط، بدون تعديل أو حذف
-- أي صلاحية قائمة
INSERT INTO users.permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'clinic.physio.case.assign', 'تعيين معالج لحالة علاج فيزيائي', 'Assign a physiotherapist to an awaiting-assignment case', 'clinic_physio', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- منح الصلاحية لـsuper_admin فقط — رئيس قسم العلاج الفيزيائي ومشرف المركز لازم تُسند
-- لدورهم الفعلي يدوياً من لوحة الإدارة
INSERT INTO users.role_permissions ("roleId", "permissionId", "assignedAt")
SELECT r.id, p.id, NOW()
FROM users.roles r
CROSS JOIN users.permissions p
WHERE r.name = 'super_admin'
  AND p.name = 'clinic.physio.case.assign'
ON CONFLICT DO NOTHING;
