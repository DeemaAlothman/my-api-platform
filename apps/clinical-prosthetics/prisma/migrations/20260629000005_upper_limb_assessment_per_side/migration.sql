-- جدول upper_limb_assessments فاضي حالياً (0 صف) — تم التحقق قبل التنفيذ، آمن إعادة بنائه بالكامل

-- 1) Enums جديدة
DO $$ BEGIN
  CREATE TYPE "clinic_prosthetics"."AssessmentSide" AS ENUM ('LEFT', 'RIGHT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "clinic_prosthetics"."JointsCondition" AS ENUM ('NORMAL', 'ACTIVE', 'SEDENTARY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) SkinColor: إضافة مصفر/Yellowish
ALTER TYPE "clinic_prosthetics"."SkinColor" ADD VALUE IF NOT EXISTS 'YELLOWISH';

-- 3) ScarCondition: القيم القديمة لا تطابق الاستمارة الورقية إطلاقاً — استبدال كامل
--    (يلمس upper_limb_assessments و lower_limb_assessments، كلاهما فاضي حالياً)
ALTER TABLE "clinic_prosthetics"."upper_limb_assessments" DROP COLUMN IF EXISTS "scarCondition";
ALTER TABLE "clinic_prosthetics"."lower_limb_assessments" DROP COLUMN IF EXISTS "scarCondition";
DROP TYPE IF EXISTS "clinic_prosthetics"."ScarCondition";
CREATE TYPE "clinic_prosthetics"."ScarCondition" AS ENUM ('OPEN', 'CLOSED', 'FLEXIBLE', 'HEALED', 'OOZING', 'INFLAMED', 'DRY');
ALTER TABLE "clinic_prosthetics"."upper_limb_assessments" ADD COLUMN "scarCondition" "clinic_prosthetics"."ScarCondition"[] NOT NULL DEFAULT ARRAY[]::"clinic_prosthetics"."ScarCondition"[];
ALTER TABLE "clinic_prosthetics"."lower_limb_assessments" ADD COLUMN "scarCondition" "clinic_prosthetics"."ScarCondition"[] NOT NULL DEFAULT ARRAY[]::"clinic_prosthetics"."ScarCondition"[];

-- 4) ProstheticsCase: الجانب الأكثر تأثراً (فقط عند BILATERAL)
ALTER TABLE "clinic_prosthetics"."prosthetics_cases" ADD COLUMN IF NOT EXISTS "moreAffectedSide" "clinic_prosthetics"."AmputationSide";

-- 5) إعادة بناء upper_limb_assessments بالكامل لدعم سطر مستقل لكل طرف (side)
DROP TABLE IF EXISTS "clinic_prosthetics"."upper_limb_assessments";

CREATE TABLE "clinic_prosthetics"."upper_limb_assessments" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "side" "clinic_prosthetics"."AssessmentSide" NOT NULL,

    "residualLimbLength" "clinic_prosthetics"."ResidualLimbLength",
    "residualLimbShape" "clinic_prosthetics"."ResidualLimbShape",
    "residualLimbPhotoUrl" TEXT,

    "painPresent" BOOLEAN NOT NULL DEFAULT false,
    "painArea" TEXT,
    "painIntensity" INTEGER,
    "painTypes" "clinic_prosthetics"."PainType"[],
    "painTypeOtherDetail" TEXT,
    "phantomPainPresent" BOOLEAN NOT NULL DEFAULT false,
    "phantomPainIntensity" INTEGER,
    "residualLimbPalpable" BOOLEAN,
    "neuromaPalpable" BOOLEAN,

    "skinAppearance" "clinic_prosthetics"."SkinAppearance"[],
    "skinNotes" TEXT,
    "skinColor" "clinic_prosthetics"."SkinColor"[],
    "skinTemperature" "clinic_prosthetics"."SkinTemperature",
    "scarCondition" "clinic_prosthetics"."ScarCondition"[],
    "hasSkinGrafts" BOOLEAN NOT NULL DEFAULT false,
    "graftArea" TEXT,

    "hasOtherAffectedLimbs" BOOLEAN,
    "currentlyUsingProsthesis" BOOLEAN,
    "previouslyUsedProsthesis" BOOLEAN,
    "previousProsthesisSystemDetail" TEXT,
    "canBalanceOneSide" BOOLEAN,
    "usesCompressionBandage" BOOLEAN,
    "jointsRangeOfMotion" "clinic_prosthetics"."JointsCondition",
    "activityLevel" "clinic_prosthetics"."KLevel",

    "romData" JSONB,
    "muscleMotionNotes" TEXT,

    "examinerProsthetistIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "examinerPhysioIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "examinerSupervisorIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "examinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upper_limb_assessments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "upper_limb_assessments_caseId_side_key" ON "clinic_prosthetics"."upper_limb_assessments"("caseId", "side");

ALTER TABLE "clinic_prosthetics"."upper_limb_assessments"
  ADD CONSTRAINT "upper_limb_assessments_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "clinic_prosthetics"."prosthetics_cases"("id") ON DELETE CASCADE;
