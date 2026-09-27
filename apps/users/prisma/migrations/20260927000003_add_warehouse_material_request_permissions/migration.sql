INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.name, v."displayName", v.description, 'warehouse', NOW(), NOW()
FROM (VALUES
  ('warehouse.material_requests.read',      'عرض كل طلبات المواد',   'View all material requests'),
  ('warehouse.material_requests.read_own',  'عرض طلباتي للمواد',      'View own material requests'),
  ('warehouse.material_requests.create',    'تقديم طلب مواد',        'Create a material request'),
  ('warehouse.material_requests.approve',   'اعتماد/صرف طلب مواد',   'Approve and issue material requests')
) AS v(name, "displayName", description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = v.name);
