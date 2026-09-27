INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.name, v."displayName", v.description, 'warehouse', NOW(), NOW()
FROM (VALUES
  ('warehouse.transfers.read',    'عرض عمليات النقل بين المستودعات', 'View stock transfers'),
  ('warehouse.transfers.create',  'إنشاء نقل بين مستودعات',          'Create a stock transfer'),
  ('warehouse.transfers.receive', 'تأكيد استلام نقل',                'Confirm receipt of a stock transfer')
) AS v(name, "displayName", description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = v.name);
