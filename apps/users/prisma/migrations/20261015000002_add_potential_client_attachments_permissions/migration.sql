INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.name, v."displayName", v.description, 'clinic', NOW(), NOW()
FROM (VALUES
  ('clinic.potential_clients.view_attachments',   'عرض مرفقات العميل المحتمل', 'View potential client attachments'),
  ('clinic.potential_clients.upload_attachments', 'رفع مرفقات للعميل المحتمل', 'Upload potential client attachments')
) AS v(name, "displayName", description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = v.name);
