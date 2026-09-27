INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.name, v."displayName", v.description, 'warehouse', NOW(), NOW()
FROM (VALUES
  ('warehouse.currencies.read',           'عرض العملات وأسعار الصرف',   'View currencies and exchange rates'),
  ('warehouse.currencies.manage',         'إدارة العملات وأسعار الصرف', 'Manage currencies and exchange rates'),
  ('warehouse.purchase_invoices.read',    'عرض فواتير الشراء',          'View purchase invoices'),
  ('warehouse.purchase_invoices.create',  'إنشاء فاتورة شراء',          'Create a purchase invoice'),
  ('warehouse.purchase_invoices.approve', 'اعتماد فاتورة شراء مالياً',   'Approve a purchase invoice financially'),
  ('warehouse.purchase_invoices.post',    'ترحيل فاتورة شراء للمخزون',  'Post a purchase invoice to stock'),
  ('warehouse.purchase_prices.view',      'رؤية أسعار الشراء الفعلية',  'View actual purchase prices')
) AS v(name, "displayName", description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = v.name);
