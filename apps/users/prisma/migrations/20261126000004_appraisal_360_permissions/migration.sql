-- صلاحيتا تقييم 360. كانتا تُزرَعان بسكربتٍ يدويٍّ بمعرِّفَين نصّيَّين مقروءَين
-- (eval-360-manage و eval-360-raters)، وواجهةُ إسناد الصلاحيات لدورٍ تَشترط أن
-- يكون كلُّ معرِّفٍ UUID، فكانتا لا تُسنَدان لأحدٍ أبداً وتُرَدُّ المحاولةُ بـ400.
-- فصارتا تُولَّدان كغيرهما، وانتقلت الزراعةُ إلى ترحيلٍ يُطبَّق من تلقائه فلا
-- يَسهو عنه نشرٌ جديد.
--
-- التعارضُ على الاسم لا على المعرِّف: الاسمُ هو ما يُعرَف به الحقُّ، والمعرِّفُ
-- صار عشوائياً. وبهذا لا يُزرَع في قاعدةٍ هما فيها بالفعل.
INSERT INTO users.permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'evaluation:appraisal:manage', 'إدارة تقييم 360',
   'إنشاء الدورات وفتحها وإغلاقها، تصنيف الأقسام، الحساب واستعراض النتائج', 'evaluation', NOW(), NOW()),
  (gen_random_uuid(), 'evaluation:appraisal:view-raters', 'تدقيق مقيّمي 360',
   'رؤية أسماء مقيّمي الزملاء والمرؤوسين (للتدقيق فقط)', 'evaluation', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- تُربَط بـ super_admin وحدَه؛ وإسنادُها لدور الموارد البشرية يجري من الشاشة
INSERT INTO users.role_permissions ("roleId", "permissionId", "assignedAt")
SELECT r.id, p.id, NOW()
FROM users.roles r, users.permissions p
WHERE r.name = 'super_admin' AND r."deletedAt" IS NULL
  AND p.name IN ('evaluation:appraisal:manage', 'evaluation:appraisal:view-raters')
  AND NOT EXISTS (
    SELECT 1 FROM users.role_permissions rp
    WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
  );
