-- صلاحيةُ تصدير PDF لحالات القسم الطبي. لا تحمي نقطةَ وصولٍ في الخادم — التصديرُ
-- يجري في الواجهة — بل تُعرَّف لتُسنَد للأدوار فتَقرأ الواجهةُ منها مَن يَملك الزرَّ.
--
-- المعرِّفُ يُولَّد ولا يُكتَب نصّاً مقروءاً: واجهةُ إسناد الصلاحيات لدورٍ تَشترط
-- أن يكون كلُّ معرِّفٍ UUID، فصلاحيةٌ بمعرِّفٍ نصّيٍّ تبقى موجودةً ولا تُسنَد
-- لأحدٍ أبداً. وقع ذلك مع صلاحيتَي تقييم 360 وصُحِّح في 2026-11-26.
--
-- والتعارضُ على الاسم لا على المعرِّف: الاسمُ هو ما يُعرَف به الحقُّ.
INSERT INTO users.permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'clinic:cases:export-pdf',
  'تصدير PDF لحالات العيادة',
  'تصدير ملفات PDF لحالات القسم الطبي: حالة الأطراف الصناعية، حالة العلاج الفيزيائي، تحليل المشي، وتعهّد التسليم النهائي',
  'clinic',
  NOW(), NOW()
)
ON CONFLICT (name) DO NOTHING;

-- تُربَط بـ super_admin لتَظهر في قائمة صلاحياته على الشاشة. وهو يَملكها فعلياً
-- بلا هذا السطر أصلاً، إذ تُحمَّل له كلُّ الصلاحيات من الجدول عند الدخول —
-- لكنَّ ما لا يَظهر في الشاشة يُحسَب غيرَ ممنوح.
INSERT INTO users.role_permissions ("roleId", "permissionId", "assignedAt")
SELECT r.id, p.id, NOW()
FROM users.roles r, users.permissions p
WHERE r.name = 'super_admin' AND r."deletedAt" IS NULL
  AND p.name = 'clinic:cases:export-pdf'
  AND NOT EXISTS (
    SELECT 1 FROM users.role_permissions rp
    WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
  );
