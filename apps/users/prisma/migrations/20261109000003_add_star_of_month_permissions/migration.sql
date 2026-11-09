-- صلاحيات نجم الشهر — إدراج فقط، بدون تعديل أو حذف أي صلاحية قائمة
INSERT INTO users.permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'star_of_month.view',              'عرض نجم الشهر',                    'View star-of-the-month cycles/results',      'star_of_month', NOW(), NOW()),
  (gen_random_uuid(), 'star_of_month.vote',               'التصويت بنجم الشهر',               'Cast peer vote for star of the month',       'star_of_month', NOW(), NOW()),
  (gen_random_uuid(), 'star_of_month.nominate',            'إضافة مرشح HR لنجم الشهر',          'Add HR nominee for star of the month',       'star_of_month', NOW(), NOW()),
  (gen_random_uuid(), 'star_of_month.manager_vote',        'تصويت المدير الإداري لنجم الشهر',   'Direct-manager vote for star of the month',  'star_of_month', NOW(), NOW()),
  (gen_random_uuid(), 'star_of_month.ceo_vote',            'تصويت المدير التنفيذي لنجم الشهر',  'CEO vote + tie-break for star of the month', 'star_of_month', NOW(), NOW()),
  (gen_random_uuid(), 'star_of_month.reward',              'اختيار مكافأة نجم الشهر',           'Choose star-of-the-month reward type',       'star_of_month', NOW(), NOW()),
  (gen_random_uuid(), 'star_of_month.moderate_comments',   'حذف تعليقات نجم الشهر',             'Delete star-of-the-month comments',          'star_of_month', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- view/vote يفترض تكون للجميع — تُمنح لـsuper_admin + الدور العام "موظف" (الدور الأساسي
-- المفروض كل موظف معيّن فيه). لو عندكم دور أساسي تاني يغطّي الكل، لازم تضيفوه يدوياً كمان
INSERT INTO users.role_permissions ("roleId", "permissionId", "assignedAt")
SELECT r.id, p.id, NOW()
FROM users.roles r
CROSS JOIN users.permissions p
WHERE r.name IN ('super_admin', 'موظف')
  AND p.name IN ('star_of_month.view', 'star_of_month.vote')
ON CONFLICT DO NOTHING;

-- باقي الصلاحيات (nominate/manager_vote/ceo_vote/reward/moderate_comments) لـsuper_admin
-- فقط الآن — تُسند للأدوار الفعلية (HR، المدير الإداري، CFO، إلخ) يدوياً من لوحة الإدارة
INSERT INTO users.role_permissions ("roleId", "permissionId", "assignedAt")
SELECT r.id, p.id, NOW()
FROM users.roles r
CROSS JOIN users.permissions p
WHERE r.name = 'super_admin'
  AND p.module = 'star_of_month'
ON CONFLICT DO NOTHING;
