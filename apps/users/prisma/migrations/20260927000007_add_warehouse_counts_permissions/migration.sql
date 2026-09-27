INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.name, v."displayName", v.description, 'warehouse', NOW(), NOW()
FROM (VALUES
  ('warehouse.counts.read',    'عرض جلسات الجرد',        'View inventory count sessions'),
  ('warehouse.counts.create',  'بدء جرد وتسجيل العدّ',    'Start an inventory count and record counted quantities'),
  ('warehouse.counts.approve', 'إنهاء/إلغاء الجرد',       'Complete or cancel an inventory count')
) AS v(name, "displayName", description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = v.name);
