-- 1) Enum سبب البتر
DO $$ BEGIN
  CREATE TYPE "clinic_prosthetics"."AmputationCause" AS ENUM (
    'WAR_INJURY','TRAFFIC_ACCIDENT','DIABETES','VASCULAR_DISEASE','CONGENITAL','INFECTION','TUMOR','WORK_INJURY','OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) prosthetics_cases: تحويل amputationCause من نص حر إلى enum + حقول جديدة
ALTER TABLE "clinic_prosthetics"."prosthetics_cases" ADD COLUMN IF NOT EXISTS "amputationCauseNew" "clinic_prosthetics"."AmputationCause";
ALTER TABLE "clinic_prosthetics"."prosthetics_cases" ADD COLUMN IF NOT EXISTS "amputationCauseOtherDetail" TEXT;
ALTER TABLE "clinic_prosthetics"."prosthetics_cases" ADD COLUMN IF NOT EXISTS "currentlyUsingProsthesis" BOOLEAN;
ALTER TABLE "clinic_prosthetics"."prosthetics_cases" ADD COLUMN IF NOT EXISTS "previouslyUsedProsthesis" BOOLEAN;
ALTER TABLE "clinic_prosthetics"."prosthetics_cases" ADD COLUMN IF NOT EXISTS "previousProsthesisSystemDetail" TEXT;

-- تحويل القيم النصية القديمة المعروفة لقيم الـ enum المطابقة
UPDATE "clinic_prosthetics"."prosthetics_cases" SET "amputationCauseNew" = 'TRAFFIC_ACCIDENT' WHERE "amputationCause" = 'حادث سير';
UPDATE "clinic_prosthetics"."prosthetics_cases" SET "amputationCauseNew" = 'WORK_INJURY'      WHERE "amputationCause" = 'حادث عمل';
UPDATE "clinic_prosthetics"."prosthetics_cases" SET "amputationCauseNew" = 'WAR_INJURY'        WHERE "amputationCause" = 'إصابة حربية';
UPDATE "clinic_prosthetics"."prosthetics_cases" SET "amputationCauseNew" = 'DIABETES'          WHERE "amputationCause" = 'مرض السكري';
-- أي قيمة نصية قديمة غير معروفة → OTHER مع حفظ النص الأصلي كامل بدون فقدان
UPDATE "clinic_prosthetics"."prosthetics_cases"
  SET "amputationCauseNew" = 'OTHER', "amputationCauseOtherDetail" = "amputationCause"
  WHERE "amputationCause" IS NOT NULL AND "amputationCauseNew" IS NULL;

ALTER TABLE "clinic_prosthetics"."prosthetics_cases" DROP COLUMN "amputationCause";
ALTER TABLE "clinic_prosthetics"."prosthetics_cases" RENAME COLUMN "amputationCauseNew" TO "amputationCause";

-- 3) upper_limb_assessments: نقل أسئلة الطرف الصناعي (حالياً/سابقاً) لمستوى الحالة — حذف من هنا
ALTER TABLE "clinic_prosthetics"."upper_limb_assessments"
  DROP COLUMN IF EXISTS "currentlyUsingProsthesis",
  DROP COLUMN IF EXISTS "previouslyUsedProsthesis",
  DROP COLUMN IF EXISTS "previousProsthesisSystemDetail";

-- 4) إعادة بناء lower_limb_assessments بالكامل لدعم سطر مستقل لكل طرف (side) — الجدول فاضي حالياً (0 صف)
DROP TABLE IF EXISTS "clinic_prosthetics"."lower_limb_assessments";

CREATE TABLE "clinic_prosthetics"."lower_limb_assessments" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "side" "clinic_prosthetics"."AssessmentSide" NOT NULL,

    "residualLimbLength" "clinic_prosthetics"."ResidualLimbLength",
    "residualLimbShape" "clinic_prosthetics"."ResidualLimbShape",
    "residualLimbPhotoUrl" TEXT,
    "amputationLevelNote" TEXT,

    "painPresent" BOOLEAN NOT NULL DEFAULT false,
    "painArea" TEXT,
    "painIntensity" INTEGER,
    "painTypes" "clinic_prosthetics"."PainType"[],
    "painTypeOtherDetail" TEXT,
    "phantomPainPresent" BOOLEAN NOT NULL DEFAULT false,
    "phantomPainIntensity" INTEGER,
    "neuromaPalpable" BOOLEAN,

    "loadTolerance" "clinic_prosthetics"."LoadTolerance",
    "weightBearingLevel" "clinic_prosthetics"."WeightBearingLevel",
    "notes" TEXT,

    "skinAppearance" "clinic_prosthetics"."SkinAppearance"[],
    "skinColor" "clinic_prosthetics"."SkinColor"[],
    "skinTemperature" "clinic_prosthetics"."SkinTemperature",
    "scarCondition" "clinic_prosthetics"."ScarCondition"[],
    "hasSkinGrafts" BOOLEAN NOT NULL DEFAULT false,
    "graftArea" TEXT,

    "otherLimbCondition" TEXT,
    "usesAssistiveDevices" BOOLEAN NOT NULL DEFAULT false,
    "assistiveDeviceTypes" TEXT,
    "canClimbStairs" BOOLEAN,
    "canBalanceOneSide" BOOLEAN,
    "jointsRangeOfMotion" "clinic_prosthetics"."JointsCondition",
    "activityLevel" "clinic_prosthetics"."KLevel",

    "romData" JSONB,
    "muscleMotionNotes" TEXT,

    "examinerProsthetistIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "examinerPhysioIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "examinerSupervisorIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "examinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lower_limb_assessments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lower_limb_assessments_caseId_side_key" ON "clinic_prosthetics"."lower_limb_assessments"("caseId", "side");

ALTER TABLE "clinic_prosthetics"."lower_limb_assessments"
  ADD CONSTRAINT "lower_limb_assessments_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "clinic_prosthetics"."prosthetics_cases"("id") ON DELETE CASCADE;
