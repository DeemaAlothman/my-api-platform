-- صلاحية تغيير حالة الموعد منفصلة عن الإنشاء (بدون الإلغاء) — إضافة صف واحد فقط
SET search_path TO users;

INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'clinic.appointments.update_status', 'تغيير حالة الموعد', 'Update appointment status (except cancel)', 'clinic_appointments', NOW(), NOW())
ON CONFLICT DO NOTHING;
