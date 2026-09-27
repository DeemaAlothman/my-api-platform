INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.name, v."displayName", v.description, 'warehouse', NOW(), NOW()
FROM (VALUES
  ('warehouse.stock.read',   'عرض أرصدة وحركات المخزون', 'View stock balances and movements'),
  ('warehouse.stock.adjust', 'تعديل رصيد يدوياً',         'Manually adjust stock (in/out)')
) AS v(name, "displayName", description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = v.name);
