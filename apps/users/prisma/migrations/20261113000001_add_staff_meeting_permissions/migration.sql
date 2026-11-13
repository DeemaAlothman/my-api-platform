-- صلاحيتا تعديل وإلغاء الاجتماعات الداخلية — إدراج فقط، بدون تعديل أو حذف أي صلاحية قائمة
INSERT INTO users.permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'clinic.appointments.internal_meetings.update', 'تعديل اجتماعات الموظفين', 'Update staff meetings created by others', 'clinic_appointments', NOW(), NOW()),
  (gen_random_uuid(), 'clinic.appointments.internal_meetings.cancel', 'إلغاء اجتماعات الموظفين', 'Cancel staff meetings created by others', 'clinic_appointments', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;
