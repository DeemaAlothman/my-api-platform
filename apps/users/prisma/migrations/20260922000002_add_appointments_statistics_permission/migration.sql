INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'clinic.appointments.statistics_view', 'عرض إحصائيات المواعيد', 'View appointments statistics report', 'clinic_appointments', NOW(), NOW());
