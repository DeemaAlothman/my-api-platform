SET search_path TO users;

-- Clinic Prosthetics permissions
INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'clinic.prosthetics.case.view',        'عرض ملفات الأطراف',         'View prosthetics cases',          'clinic_prosthetics', NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.prosthetics.case.create',       'إنشاء ملف أطراف',           'Create prosthetics case',         'clinic_prosthetics', NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.prosthetics.assessment.create', 'إنشاء تقييم أطراف',         'Create prosthetics assessment',   'clinic_prosthetics', NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.prosthetics.committee.opinion', 'إضافة رأي اللجنة',          'Add committee opinion',           'clinic_prosthetics', NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.prosthetics.committee.decide',  'قرار اللجنة',               'Make committee decision',         'clinic_prosthetics', NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.prosthetics.committee.sign',    'توقيع اللجنة',              'Sign committee review',           'clinic_prosthetics', NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.prosthetics.components.add',    'إضافة مكونات',              'Add prosthetic components',       'clinic_prosthetics', NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.prosthetics.gait.create',       'إنشاء تحليل مشي',           'Create gait analysis',            'clinic_prosthetics', NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.prosthetics.delivery.create',   'إنشاء تسليم',               'Create delivery record',          'clinic_prosthetics', NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.prosthetics.delivery.approve',  'اعتماد التسليم',            'Approve delivery',                'clinic_prosthetics', NOW(), NOW()),

-- Clinic Physio permissions
  (gen_random_uuid()::text, 'clinic.physio.case.view',              'عرض ملفات العلاج الطبيعي', 'View physio cases',               'clinic_physio',      NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.physio.case.create',            'إنشاء ملف علاج طبيعي',     'Create physio case',              'clinic_physio',      NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.physio.assessment.create',      'إنشاء تقييم فيزيائي',      'Create physio assessment',        'clinic_physio',      NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.physio.plan.sign',              'توقيع خطة العلاج',          'Sign treatment plan',             'clinic_physio',      NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.physio.sessions.create',        'إنشاء جلسات علاجية',       'Create therapy sessions',         'clinic_physio',      NOW(), NOW()),

-- Clinic Appointments permissions
  (gen_random_uuid()::text, 'clinic.appointments.view',             'عرض المواعيد',              'View appointments',               'clinic_appointments',NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.appointments.create',           'إنشاء موعد',                'Create appointment',              'clinic_appointments',NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.appointments.cancel',           'إلغاء موعد',                'Cancel appointment',              'clinic_appointments',NOW(), NOW()),

-- Clinic Inventory permissions
  (gen_random_uuid()::text, 'clinic.inventory.view',                'عرض المخزون',               'View inventory',                  'clinic_inventory',   NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.inventory.manage',              'إدارة المخزون',             'Manage inventory items',          'clinic_inventory',   NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.inventory.issue',               'صرف من المخزون',            'Issue inventory items',           'clinic_inventory',   NOW(), NOW()),

-- Clinic Reports permissions
  (gen_random_uuid()::text, 'clinic.reports.view_clinical',         'عرض التقارير السريرية',    'View clinical reports',           'clinic_reports',     NOW(), NOW()),
  (gen_random_uuid()::text, 'clinic.reports.view_donor',            'عرض تقارير المانحين',      'View donor reports',              'clinic_reports',     NOW(), NOW())

ON CONFLICT (name) DO NOTHING;
