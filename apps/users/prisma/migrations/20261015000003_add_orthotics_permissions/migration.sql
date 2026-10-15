INSERT INTO users.permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'clinic.orthotics.view',                       'عرض استقبالات المقومات',          'View orthotics receptions',               'clinic_orthotics', NOW(), NOW()),
  (gen_random_uuid(), 'clinic.orthotics.create',                     'إنشاء استقبال المقومات',          'Create orthotics reception',              'clinic_orthotics', NOW(), NOW()),
  (gen_random_uuid(), 'clinic.orthotics.edit',                       'تعديل استقبال المقومات',          'Edit orthotics reception',                'clinic_orthotics', NOW(), NOW()),
  (gen_random_uuid(), 'clinic.orthotics.delete',                     'حذف استقبال المقومات',            'Delete orthotics reception',              'clinic_orthotics', NOW(), NOW()),
  (gen_random_uuid(), 'clinic.orthotics.doctor_assessment.edit',     'تعبئة تقييم طبيب العظمية',        'Edit orthotics doctor assessment',        'clinic_orthotics', NOW(), NOW()),
  (gen_random_uuid(), 'clinic.orthotics.physio_assessment.edit',     'تعبئة تقييم أخصائي العلاج الفيزيائي', 'Edit orthotics physio assessment',     'clinic_orthotics', NOW(), NOW()),
  (gen_random_uuid(), 'clinic.orthotics.prosthetist_opinion.edit',   'تعبئة رأي أخصائي الأطراف الصناعية', 'Edit orthotics prosthetist opinion',    'clinic_orthotics', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;
