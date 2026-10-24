-- يضمن وجود الصلاحية بالنص المطلوب من الفرونت بالضبط، سواء كانت أُدرجت سابقاً
-- (بنص مختلف) أو لم تُدرج بعد — بدون أي أثر على ربطها الحالي بالأدوار (RolePermission
-- يرتبط بـ permissionId الثابت، لا بالاسم أو النص المعروض).
INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'clinic.orthotics.measurement.create',
  'إضافة ورقة قياس (المقومات)',
  'Add measurement sheet (orthotics)',
  'clinic_orthotics',
  NOW(),
  NOW()
)
ON CONFLICT (name) DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  description   = EXCLUDED.description,
  module        = EXCLUDED.module,
  "updatedAt"   = NOW();
