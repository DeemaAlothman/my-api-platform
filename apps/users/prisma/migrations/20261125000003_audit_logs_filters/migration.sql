-- اسمُ السجل المستهدَف يُحفَظ لحظةَ العملية بدلاً من أن يُحسَب لحظةَ العرض.
-- المحسوبُ لا يُفهرَس ولا يُبحَث فيه، لأنه لا يوجد وقتَ الفلترة بل بعدها؛
-- وسجلٌّ حُذِف لا يبقى له اسمٌ يُقرأ لاحقاً، فأهمُّ ما يُدقَّق أقلُّه أثراً.
-- إضافةٌ محضة: خانةٌ فارغة إلى جانب الخانات القائمة، لا تمسُّ قيمةً مكتوبة،
-- والسجلات السابقة تبقى كما هي ولا تُرحَّل.
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS "targetName" TEXT;

-- فهارس الفلاتر الجديدة. idx_audit_logs_user_id قائم من ترحيل إنشاء الجدول.
-- كلها جزئية (WHERE ...) فلا تحمل الأسطر التي لا تَخُصُّ الفلتر، وهي الأكثرية.
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_name
  ON public.audit_logs (LOWER("targetName")) WHERE "targetName" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_meta_status
  ON public.audit_logs ((metadata->>'status')) WHERE (metadata->>'status') IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_meta_patient
  ON public.audit_logs ((metadata->>'patientId')) WHERE (metadata->>'patientId') IS NOT NULL;

-- فلترةُ «كل العمليات على مريض» تُطابق المعرِّف في resourceId أيضاً، لا في metadata فقط
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id
  ON public.audit_logs ("resourceId") WHERE "resourceId" IS NOT NULL;
