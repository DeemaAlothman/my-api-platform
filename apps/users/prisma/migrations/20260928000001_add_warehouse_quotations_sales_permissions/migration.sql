INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.name, v."displayName", v.description, 'warehouse', NOW(), NOW()
FROM (VALUES
  ('warehouse.quotations.read',         'عرض عروض الأسعار',              'View quotations'),
  ('warehouse.quotations.create',       'إنشاء/تعديل عروض الأسعار',       'Create and edit quotations'),
  ('warehouse.quotations.approve',      'اعتماد/إرسال/قبول/رفض العرض',    'Approve, send, accept or reject a quotation'),
  ('warehouse.quotations.edit_prices',  'تعديل أسعار العرض بدون نسخة جديدة', 'Adjust quotation prices/discounts without opening a new version'),
  ('warehouse.quotations.view_prices',  'عرض الأسعار (نسخة غير الفني)',    'View quotation prices — hidden from technicians'),
  ('warehouse.sales_invoices.read',     'عرض فواتير المبيعات',            'View sales invoices'),
  ('warehouse.sales_invoices.create',   'توليد فاتورة مبيعات من عرض',      'Generate a sales invoice from an accepted quotation'),
  ('warehouse.sales_invoices.approve',  'اعتماد فاتورة المبيعات',          'Approve a sales invoice')
) AS v(name, "displayName", description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = v.name);
