INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.name, v."displayName", v.description, 'clinic', NOW(), NOW()
FROM (VALUES
  ('clinic.appointments.internal_meetings.create', 'إنشاء اجتماع/تدريب داخلي', 'Create an internal meeting or training appointment'),
  ('clinic.appointments.internal_meetings.view',   'عرض الاجتماعات/التدريبات الداخلية', 'View internal meetings and trainings')
) AS v(name, "displayName", description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = v.name);
