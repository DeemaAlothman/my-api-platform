-- قرار المناسبة + جلسات المتابعة للمقومات.
--
-- إضافة فقط: خمسة أعمدة تقبل NULL على الاستقبالات، وجدول متابعة جديد.
-- صفر تعديل وصفر حذف لأي استقبال قائم.
--
-- isSuitable يقبل NULL عمداً: «لم يُقرَّر بعد» حالة مختلفة عن «غير مناسب»،
-- فلو جعلناه false افتراضياً لظهرت كل الحالات القديمة غير مناسبة وهي لم تُقيَّم.

ALTER TABLE "clinic_orthotics"."orthotics_receptions"
  ADD COLUMN IF NOT EXISTS "isSuitable" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "suitabilityNote" TEXT,
  ADD COLUMN IF NOT EXISTS "targetAppliancesCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "suitabilityUpdatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "suitabilityUpdatedBy" TEXT;

CREATE INDEX IF NOT EXISTS "orthotics_receptions_isSuitable_idx"
  ON "clinic_orthotics"."orthotics_receptions" ("isSuitable");

CREATE TABLE IF NOT EXISTS "clinic_orthotics"."orthotics_follow_ups" (
  "id"             TEXT NOT NULL,
  "receptionId"    TEXT NOT NULL,
  "visitDate"      TIMESTAMP(3) NOT NULL,
  "findings"       TEXT NOT NULL,
  "actions"        TEXT,
  "practitionerId" TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orthotics_follow_ups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "orthotics_follow_ups_receptionId_idx"
  ON "clinic_orthotics"."orthotics_follow_ups" ("receptionId");

DO $$
BEGIN
  ALTER TABLE "clinic_orthotics"."orthotics_follow_ups"
    ADD CONSTRAINT "orthotics_follow_ups_receptionId_fkey"
    FOREIGN KEY ("receptionId") REFERENCES "clinic_orthotics"."orthotics_receptions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- كاتب رأي أخصائي الأطراف الصناعية — القسم الوحيد الذي لم يكن يسجّل كاتبه.
-- إضافة فقط: عمودان يقبلان NULL. السجلات السابقة تبقى بلا كاتب، وهو الصحيح
-- لأن المعلومة لم تكن تُحفظ وقتها.
ALTER TABLE "clinic_orthotics"."orthotics_receptions"
  ADD COLUMN IF NOT EXISTS "prosthetistOpinionUpdatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "prosthetistOpinionUpdatedBy" TEXT;

-- سبب البتر (نفس قائمة الأطراف الصناعية) + تفصيل كل مقوّم على حدة.
-- إضافة فقط: ثلاثة أعمدة تقبل NULL. appliancesCount و affectedLimbType و
-- affectedSide تبقى كما هي ولا تُنقل قيمها.
ALTER TABLE "clinic_orthotics"."orthotics_receptions"
  ADD COLUMN IF NOT EXISTS "amputationCause" TEXT,
  ADD COLUMN IF NOT EXISTS "amputationCauseOtherDetail" TEXT,
  ADD COLUMN IF NOT EXISTS "appliancesDetails" JSONB;
