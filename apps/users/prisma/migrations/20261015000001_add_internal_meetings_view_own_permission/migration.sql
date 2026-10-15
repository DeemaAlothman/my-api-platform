INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.name, v."displayName", v.description, 'clinic', NOW(), NOW()
FROM (VALUES
  ('clinic.appointments.internal_meetings.view_own', 'عرض اجتماعاتي/تدريباتي أنا فقط', 'View own internal meetings/trainings (as an attendee)')
) AS v(name, "displayName", description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = v.name);
