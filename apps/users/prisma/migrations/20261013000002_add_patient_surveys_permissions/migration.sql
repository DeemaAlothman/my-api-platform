INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.name, v."displayName", v.description, 'clinic', NOW(), NOW()
FROM (VALUES
  ('clinic.patients.surveys.create', 'تعبئة استبيان تقييم رضا العملاء', 'Submit a patient satisfaction survey'),
  ('clinic.patients.surveys.view',   'عرض استبيانات تقييم رضا العملاء', 'View patient satisfaction surveys')
) AS v(name, "displayName", description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = v.name);
