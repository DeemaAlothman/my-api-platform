INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.name, v."displayName", v.description, 'clinic_orthotics', NOW(), NOW()
FROM (VALUES
  ('clinic.orthotics.measurement.create', 'إضافة ورقة قياس المقومات', 'Create orthotics measurement sheet')
) AS v(name, "displayName", description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = v.name);
