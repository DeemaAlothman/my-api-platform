-- صلاحيات العملاء المحتملين — إضافة 4 صفوف فقط
SET search_path TO users;

INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'clinic.potential_clients.view',   'عرض العملاء المحتملين',   'عرض قائمة العملاء المحتملين',  'clinic_appointments', NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.potential_clients.create', 'إضافة عميل محتمل',        'تسجيل عميل محتمل جديد',        'clinic_appointments', NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.potential_clients.edit',   'تعديل العملاء المحتملين', 'تعديل سجل عميل محتمل',         'clinic_appointments', NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.potential_clients.delete', 'حذف عميل محتمل',          'حذف سجل من العملاء المحتملين', 'clinic_appointments', NOW(), NOW())
ON CONFLICT DO NOTHING;
