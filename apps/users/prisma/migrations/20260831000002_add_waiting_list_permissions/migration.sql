SET search_path TO users;

INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt") VALUES
  (gen_random_uuid()::text, 'clinic.waiting_list.view',   'عرض قائمة الانتظار',   'عرض قائمة انتظار العيادة',        'clinic_appointments', NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.waiting_list.create', 'إضافة لقائمة الانتظار', 'تسجيل مريض جديد بقائمة الانتظار', 'clinic_appointments', NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.waiting_list.edit',   'تعديل قائمة الانتظار', 'تعديل سجل بقائمة الانتظار',       'clinic_appointments', NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.waiting_list.delete', 'حذف من قائمة الانتظار', 'حذف سجل من قائمة الانتظار',       'clinic_appointments', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;
