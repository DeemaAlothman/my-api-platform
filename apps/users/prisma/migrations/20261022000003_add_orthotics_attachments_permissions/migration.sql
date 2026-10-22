INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.name, v."displayName", v.description, 'clinic_orthotics', NOW(), NOW()
FROM (VALUES
  ('clinic.orthotics.view_attachments',   'عرض مرفقات المقومات',   'View orthotics attachments'),
  ('clinic.orthotics.upload_attachments', 'رفع مرفقات المقومات',   'Upload orthotics attachments')
) AS v(name, "displayName", description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = v.name);
