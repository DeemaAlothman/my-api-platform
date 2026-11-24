-- صلاحية «تم التسليم» لاستقبال المقومات — إضافة فقط، لا أثر على أي صلاحية أو دور موجود.
INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.name, v."displayName", v.description, 'clinic_orthotics', NOW(), NOW()
FROM (VALUES
  ('clinic.orthotics.deliver', 'تسليم استقبال المقومات', 'Mark an orthotics reception as delivered')
) AS v(name, "displayName", description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = v.name);
