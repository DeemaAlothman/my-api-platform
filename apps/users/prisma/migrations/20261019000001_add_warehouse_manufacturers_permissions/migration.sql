INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.name, v."displayName", v.description, 'warehouse', NOW(), NOW()
FROM (VALUES
  ('warehouse.manufacturers.read',   'عرض الشركات المصنّعة',   'View manufacturers'),
  ('warehouse.manufacturers.create', 'إضافة شركة مصنّعة',      'Create manufacturer'),
  ('warehouse.manufacturers.update', 'تعديل شركة مصنّعة',      'Update manufacturer'),
  ('warehouse.manufacturers.delete', 'حذف شركة مصنّعة',        'Delete manufacturer')
) AS v(name, "displayName", description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = v.name);
