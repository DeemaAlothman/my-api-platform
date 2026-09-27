INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.name, v."displayName", v.description, 'warehouse', NOW(), NOW()
FROM (VALUES
  ('warehouse.warehouses.read',   'عرض المستودعات',      'View warehouses'),
  ('warehouse.warehouses.create', 'إضافة مستودع',        'Create warehouse'),
  ('warehouse.warehouses.update', 'تعديل مستودع',        'Update warehouse'),
  ('warehouse.items.read',        'عرض أصناف المستودع',  'View warehouse items'),
  ('warehouse.items.create',      'إضافة صنف',           'Create warehouse item'),
  ('warehouse.items.update',      'تعديل صنف',           'Update warehouse item'),
  ('warehouse.units.read',        'عرض وحدات القياس',    'View units of measure'),
  ('warehouse.units.create',      'إضافة وحدة قياس',     'Create unit of measure'),
  ('warehouse.units.update',      'تعديل وحدة قياس',     'Update unit of measure'),
  ('warehouse.suppliers.read',    'عرض الموردين',        'View suppliers'),
  ('warehouse.suppliers.create',  'إضافة مورّد',          'Create supplier'),
  ('warehouse.suppliers.update',  'تعديل مورّد',          'Update supplier')
) AS v(name, "displayName", description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = v.name);
