-- صلاحيتا تكلفة الضبان بصفحة مبيعات فيتافوت — إدراج فقط، بدون تعديل أو حذف أي صلاحية قائمة
INSERT INTO users.permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'clinic.podiatry.sales.view-cost',   'عرض تكلفة الضبان',  'View insole cost on podiatry sales',   'clinic_podiatry', NOW(), NOW()),
  (gen_random_uuid(), 'clinic.podiatry.sales.update-cost', 'تعديل تكلفة الضبان', 'Update insole cost on podiatry sales', 'clinic_podiatry', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;
