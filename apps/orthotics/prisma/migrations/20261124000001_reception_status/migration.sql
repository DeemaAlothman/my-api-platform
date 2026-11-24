-- حالة استقبال المقومات — إضافة أعمدة جديدة فقط + حساب أولي للحالة.
-- لا يُعدَّل أي عمود موجود: الحساب الأولي يكتب في عمود status الجديد وحده.

ALTER TABLE "clinic_orthotics"."orthotics_receptions"
  ADD COLUMN IF NOT EXISTS "status"      TEXT NOT NULL DEFAULT 'IN_EXAMINATION',
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deliveredBy" TEXT;

CREATE INDEX IF NOT EXISTS "orthotics_receptions_status_idx"
  ON "clinic_orthotics"."orthotics_receptions"("status");

-- ── الحساب الأولي للاستقبالات الموجودة (مرة وحدة) ──────────────────────────
-- يلمس فقط ما زال IN_EXAMINATION، فإعادة تشغيله آمنة ولا تُرجع أي حالة للخلف.
-- كل تغيير يُسجَّل بسجل التدقيق مع trigger = BACKFILL.

-- 1) في ورقة قياس ← MEASURED
WITH upd AS (
  UPDATE "clinic_orthotics"."orthotics_receptions" r
     SET "status" = 'MEASURED'
   WHERE r."status" = 'IN_EXAMINATION'
     AND EXISTS (SELECT 1 FROM "clinic_orthotics"."orthotics_measurement_sheets" m WHERE m."receptionId" = r.id)
  RETURNING r.id
)
INSERT INTO public.audit_logs ("userId", username, action, resource, "resourceId", method, path, ip, metadata, "createdAt")
SELECT NULL, NULL, 'ORTHOTICS_RECEPTION_STATUS_CHANGED', 'orthotics_receptions', upd.id, 'SYSTEM',
       '/api/v1/orthotics/receptions/' || upd.id, NULL,
       '{"from":"IN_EXAMINATION","to":"MEASURED","trigger":"BACKFILL"}'::jsonb, NOW()
FROM upd;

-- 2) تاب الأطراف الصناعية مكتمل ← EXAMINED
--    رأي أخصائي الأطراف معبّأ + واحد على الأقل من: قصة الولادة، التاريخ المرضي،
--    الأهداف الوظيفية، الأجهزة الموصى بها
WITH upd AS (
  UPDATE "clinic_orthotics"."orthotics_receptions" r
     SET "status" = 'EXAMINED'
   WHERE r."status" = 'IN_EXAMINATION'
     AND COALESCE(btrim(r."prosthetistOpinion"), '') <> ''
     AND (   COALESCE(btrim(r."birthHistory"), '') <> ''
          OR COALESCE(btrim(r."medicalHistory"), '') <> ''
          OR EXISTS (SELECT 1 FROM unnest(r."functionalGoals") g WHERE COALESCE(btrim(g), '') <> '')
          OR EXISTS (SELECT 1 FROM unnest(r."recommendedDeviceTypes") d WHERE COALESCE(btrim(d), '') <> ''))
  RETURNING r.id
)
INSERT INTO public.audit_logs ("userId", username, action, resource, "resourceId", method, path, ip, metadata, "createdAt")
SELECT NULL, NULL, 'ORTHOTICS_RECEPTION_STATUS_CHANGED', 'orthotics_receptions', upd.id, 'SYSTEM',
       '/api/v1/orthotics/receptions/' || upd.id, NULL,
       '{"from":"IN_EXAMINATION","to":"EXAMINED","trigger":"BACKFILL"}'::jsonb, NOW()
FROM upd;
