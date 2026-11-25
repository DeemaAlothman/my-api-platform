-- عدد الضبانات في هذا النموذج، وحالة تركيبه.
--
-- الحالة ثلاثية عمداً: null «غير محدَّد» تختلف عن NOT_INSTALLED «لم يُركَّب».
-- فالنموذج الذي لم يُبتّ فيه بعد ليس نموذجاً تقرّر عدم تركيبه.
ALTER TABLE clinic_podiatry.podiatry_sessions
  ADD COLUMN IF NOT EXISTS "insolesCount"  INTEGER,
  ADD COLUMN IF NOT EXISTS "installStatus" TEXT;

-- ما رُكِّب فعلاً يُعرف من installedAt، فيُعلَّن مركَّباً. وما عداه يبقى غير
-- محدَّد: لا نُسقط على الماضي قراراً بعدم التركيب لم يتّخذه أحد.
UPDATE clinic_podiatry.podiatry_sessions
SET "installStatus" = 'INSTALLED'
WHERE "installedAt" IS NOT NULL AND "installStatus" IS NULL;
