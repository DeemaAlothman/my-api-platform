-- معايير الصفات الشخصية الثابتة (14 معيار)
INSERT INTO jobs."PersonalCriterion" (id, "nameAr", "maxScore", "displayOrder", "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'الالتزام بموعد المقابلة',                              5,  1,  true, NOW(), NOW()),
  (gen_random_uuid(), 'المظهر الخارجي',                                        5,  2,  true, NOW(), NOW()),
  (gen_random_uuid(), 'قوة الشخصية والثقة بالنفس',                            5,  3,  true, NOW(), NOW()),
  (gen_random_uuid(), 'مهارات التواصل الفعال ولغة الجسد',                     5,  4,  true, NOW(), NOW()),
  (gen_random_uuid(), 'مستوى اللغة الإنجليزية',                               5,  5,  true, NOW(), NOW()),
  (gen_random_uuid(), 'مدى معرفته بمتطلبات الشاغر ومهامه',                   5,  6,  true, NOW(), NOW()),
  (gen_random_uuid(), 'القدرة على التعامل مع المواقف (افتراض سيناريوهات)',    5,  7,  true, NOW(), NOW()),
  (gen_random_uuid(), 'مدى معرفته بإيجابياته وسلبياته',                       5,  8,  true, NOW(), NOW()),
  (gen_random_uuid(), 'هل يوجد إنجاز عملي سابق يحسب له',                     5,  9,  true, NOW(), NOW()),
  (gen_random_uuid(), 'القدرة على العمل تحت الضغط',                           5, 10,  true, NOW(), NOW()),
  (gen_random_uuid(), 'احترامه لخصوصية وسرية عمله السابق',                   5, 11,  true, NOW(), NOW()),
  (gen_random_uuid(), 'الدورات التدريبية',                                     5, 12,  true, NOW(), NOW()),
  (gen_random_uuid(), 'مدى معرفته الأساسية عن الشركة',                        5, 13,  true, NOW(), NOW()),
  (gen_random_uuid(), 'المصداقية في الإجابات',                                 5, 14,  true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- معايير المهارات الحاسوبية الثابتة (3 معايير)
INSERT INTO jobs."ComputerCriterion" (id, "nameAr", "maxScore", "displayOrder", "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'Microsoft Office',                              5, 1, true, NOW(), NOW()),
  (gen_random_uuid(), 'نظام ERP وGoogle Drive وأدوات الاجتماعات',    5, 2, true, NOW(), NOW()),
  (gen_random_uuid(), 'المراسلات والبريد الإلكتروني',                 5, 3, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
