INSERT INTO users.permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'clinic.podiatry.reception.view',   'عرض استقبالات طب الأقدام', 'View podiatry receptions',   'clinic_podiatry', NOW(), NOW()),
  (gen_random_uuid(), 'clinic.podiatry.reception.create', 'إنشاء استقبال طب الأقدام', 'Create podiatry reception',  'clinic_podiatry', NOW(), NOW()),
  (gen_random_uuid(), 'clinic.podiatry.reception.edit',   'تعديل استقبال طب الأقدام', 'Edit podiatry reception',    'clinic_podiatry', NOW(), NOW()),
  (gen_random_uuid(), 'clinic.podiatry.session.create',   'إنشاء جلسة طب الأقدام',    'Create podiatry session',    'clinic_podiatry', NOW(), NOW()),
  (gen_random_uuid(), 'clinic.podiatry.session.edit',     'تعديل جلسة طب الأقدام',    'Edit podiatry session',      'clinic_podiatry', NOW(), NOW()),
  (gen_random_uuid(), 'clinic.podiatry.session.archive',  'أرشفة جلسة طب الأقدام',    'Archive podiatry session',   'clinic_podiatry', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;
