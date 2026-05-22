-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "clinic_prosthetics";

-- CreateEnums
CREATE TYPE "clinic_prosthetics"."AmputationType" AS ENUM ('UPPER', 'LOWER');
CREATE TYPE "clinic_prosthetics"."AmputationSide" AS ENUM ('RIGHT', 'LEFT', 'BILATERAL');
CREATE TYPE "clinic_prosthetics"."AmputationLevel" AS ENUM ('PH', 'WD', 'TR', 'ED', 'TH', 'SD', 'PF', 'CHOPART', 'TT', 'KD', 'TF', 'HD');
CREATE TYPE "clinic_prosthetics"."CaseStatus" AS ENUM ('INTAKE', 'ASSESSMENT', 'COMMITTEE_REVIEW', 'APPROVED', 'FITTING', 'SOCKET_TRIAL', 'GAIT_TRAINING', 'FINAL_REVIEW', 'DELIVERED', 'FOLLOW_UP', 'CANCELLED');
CREATE TYPE "clinic_prosthetics"."ProsthesisType" AS ENUM ('BIONIC', 'MYOBOCK', 'MECHANIC', 'COSMETIC_COVER', 'OTHER');
CREATE TYPE "clinic_prosthetics"."KLevel" AS ENUM ('K0', 'K1', 'K2', 'K3', 'K4');
CREATE TYPE "clinic_prosthetics"."CommitteeDecision" AS ENUM ('APPROVED', 'NEEDS_ADJUSTMENT', 'REJECTED');
CREATE TYPE "clinic_prosthetics"."ComponentSource" AS ENUM ('WAREHOUSE', 'SUPPLIER');
CREATE TYPE "clinic_prosthetics"."ResidualLimbLength" AS ENUM ('LONG', 'MEDIUM', 'SHORT', 'VERY_SHORT');
CREATE TYPE "clinic_prosthetics"."ResidualLimbShape" AS ENUM ('BONY', 'SOFT', 'NORMAL', 'CONICAL_BONY', 'CONICAL_SOFT');
CREATE TYPE "clinic_prosthetics"."SkinTemperature" AS ENUM ('NORMAL', 'HOT', 'COLD');
CREATE TYPE "clinic_prosthetics"."PainType" AS ENUM ('NUMBNESS', 'DULL_ACHE', 'HOT_BURNING', 'SHARP_STABBING', 'PINS', 'OTHER');
CREATE TYPE "clinic_prosthetics"."SkinAppearance" AS ENUM ('NORMAL', 'PALE', 'DRY', 'INFLAMED', 'PEELING', 'OOZING');
CREATE TYPE "clinic_prosthetics"."SkinColor" AS ENUM ('NORMAL', 'PALE', 'CYANOTIC', 'ERYTHEMATOUS');
CREATE TYPE "clinic_prosthetics"."ScarCondition" AS ENUM ('NORMAL', 'RAISED', 'DEPRESSED', 'ADHERENT', 'MOBILE');
CREATE TYPE "clinic_prosthetics"."LoadTolerance" AS ENUM ('NOT_PALPABLE', 'PALPABLE', 'NON_WEIGHT_BEARING', 'WEIGHT_BEARING');
CREATE TYPE "clinic_prosthetics"."WeightBearingLevel" AS ENUM ('FULL', 'HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "clinic_prosthetics"."QualityLevel" AS ENUM ('GOOD', 'FAIR', 'POOR');
CREATE TYPE "clinic_prosthetics"."IndependenceLevel" AS ENUM ('INDEPENDENT', 'ASSISTED');
CREATE TYPE "clinic_prosthetics"."StabilityLevel" AS ENUM ('STABLE', 'UNSTABLE');
CREATE TYPE "clinic_prosthetics"."AssistiveDevice" AS ENUM ('NONE', 'CANE', 'CRUTCHES', 'WALKER');
CREATE TYPE "clinic_prosthetics"."FallRiskLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH');
CREATE TYPE "clinic_prosthetics"."AlignmentStatus" AS ENUM ('GOOD', 'NEEDS_ADJUSTMENT');
CREATE TYPE "clinic_prosthetics"."SuspensionSystem" AS ENUM ('PIN', 'PASSIVE_VACUUM', 'ACTIVE_VACUUM', 'DVS', 'SOFT_SOCKET', 'BELT_STRAP', 'OTHER');
CREATE TYPE "clinic_prosthetics"."SocketBearing" AS ENUM ('PTB', 'TSB', 'MAS', 'ISCHIAL_CONTAINMENT', 'OTHER');
CREATE TYPE "clinic_prosthetics"."KneeJointType" AS ENUM ('MECHANICAL', 'HYDRAULIC', 'POLYCENTRIC', 'MONOCENTRIC', 'MKP', 'OTHER');
CREATE TYPE "clinic_prosthetics"."FootType" AS ENUM ('DYNAMIC', 'HYDRAULIC', 'SACH', 'CARBON', 'SINGLE_AXIS', 'MULTI_AXIS', 'OTHER');

-- CreateTable: prosthetics_cases
CREATE TABLE "clinic_prosthetics"."prosthetics_cases" (
    "id" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "amputationDate" TIMESTAMP(3) NOT NULL,
    "amputationCause" TEXT NOT NULL,
    "amputationCount" INTEGER NOT NULL DEFAULT 1,
    "amputationType" "clinic_prosthetics"."AmputationType" NOT NULL,
    "amputationSide" "clinic_prosthetics"."AmputationSide" NOT NULL,
    "amputationLevel" "clinic_prosthetics"."AmputationLevel" NOT NULL,
    "status" "clinic_prosthetics"."CaseStatus" NOT NULL DEFAULT 'INTAKE',
    "hasPreviousProsthesis" BOOLEAN NOT NULL DEFAULT false,
    "previousProsthesisDetails" TEXT,
    "hasRevisionSurgery" BOOLEAN NOT NULL DEFAULT false,
    "revisionDetails" TEXT,
    "hasPhysicalTherapy" BOOLEAN NOT NULL DEFAULT false,
    "hasChronicDiseases" BOOLEAN NOT NULL DEFAULT false,
    "chronicDiseases" TEXT,
    "prosthetistId" TEXT,
    "physiotherapistId" TEXT,
    "supervisingDoctorId" TEXT,
    "workshopSupervisorId" TEXT,
    "prosthesisType" "clinic_prosthetics"."ProsthesisType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "prosthetics_cases_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "prosthetics_cases_caseNumber_key" ON "clinic_prosthetics"."prosthetics_cases"("caseNumber");
CREATE INDEX "prosthetics_cases_patientId_idx" ON "clinic_prosthetics"."prosthetics_cases"("patientId");
CREATE INDEX "prosthetics_cases_status_idx" ON "clinic_prosthetics"."prosthetics_cases"("status");

-- CreateTable: upper_limb_assessments
CREATE TABLE "clinic_prosthetics"."upper_limb_assessments" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "residualLimbLength" "clinic_prosthetics"."ResidualLimbLength",
    "residualLimbShape" "clinic_prosthetics"."ResidualLimbShape",
    "residualLimbPhotoUrl" TEXT,
    "painPresent" BOOLEAN NOT NULL DEFAULT false,
    "painArea" TEXT,
    "painIntensity" INTEGER,
    "painTypes" "clinic_prosthetics"."PainType"[],
    "phantomPainPresent" BOOLEAN NOT NULL DEFAULT false,
    "phantomPainIntensity" INTEGER,
    "neuromaPalpable" BOOLEAN,
    "skinAppearance" "clinic_prosthetics"."SkinAppearance"[],
    "skinColor" "clinic_prosthetics"."SkinColor"[],
    "skinTemperature" "clinic_prosthetics"."SkinTemperature",
    "scarCondition" "clinic_prosthetics"."ScarCondition"[],
    "hasSkinGrafts" BOOLEAN NOT NULL DEFAULT false,
    "graftArea" TEXT,
    "activityLevel" "clinic_prosthetics"."KLevel",
    "usesCompressionBandage" BOOLEAN,
    "romData" JSONB,
    "canBalanceOneSide" BOOLEAN,
    "notes" TEXT,
    "examinerProsthetistId" TEXT NOT NULL,
    "examinerPhysioId" TEXT NOT NULL,
    "examinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "upper_limb_assessments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "upper_limb_assessments_caseId_key" ON "clinic_prosthetics"."upper_limb_assessments"("caseId");

-- CreateTable: lower_limb_assessments
CREATE TABLE "clinic_prosthetics"."lower_limb_assessments" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "loadTolerance" "clinic_prosthetics"."LoadTolerance",
    "weightBearingLevel" "clinic_prosthetics"."WeightBearingLevel",
    "otherLimbCondition" TEXT,
    "usesAssistiveDevices" BOOLEAN NOT NULL DEFAULT false,
    "assistiveDeviceTypes" TEXT,
    "canClimbStairs" BOOLEAN,
    "canBalanceOneSide" BOOLEAN,
    "residualLimbLength" "clinic_prosthetics"."ResidualLimbLength",
    "residualLimbShape" "clinic_prosthetics"."ResidualLimbShape",
    "residualLimbPhotoUrl" TEXT,
    "painPresent" BOOLEAN NOT NULL DEFAULT false,
    "painArea" TEXT,
    "painIntensity" INTEGER,
    "painTypes" "clinic_prosthetics"."PainType"[],
    "phantomPainPresent" BOOLEAN NOT NULL DEFAULT false,
    "phantomPainIntensity" INTEGER,
    "neuromaPalpable" BOOLEAN,
    "skinAppearance" "clinic_prosthetics"."SkinAppearance"[],
    "skinColor" "clinic_prosthetics"."SkinColor"[],
    "skinTemperature" "clinic_prosthetics"."SkinTemperature",
    "scarCondition" "clinic_prosthetics"."ScarCondition"[],
    "hasSkinGrafts" BOOLEAN NOT NULL DEFAULT false,
    "graftArea" TEXT,
    "activityLevel" "clinic_prosthetics"."KLevel",
    "romData" JSONB,
    "notes" TEXT,
    "examinerProsthetistId" TEXT NOT NULL,
    "examinerPhysioId" TEXT NOT NULL,
    "examinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lower_limb_assessments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "lower_limb_assessments_caseId_key" ON "clinic_prosthetics"."lower_limb_assessments"("caseId");

-- CreateTable: committee_reviews
CREATE TABLE "clinic_prosthetics"."committee_reviews" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "prosthetistOpinion" TEXT, "prosthetistUserId" TEXT, "prosthetistReviewedAt" TIMESTAMP(3),
    "physiotherapistOpinion" TEXT, "physiotherapistUserId" TEXT, "physiotherapistReviewedAt" TIMESTAMP(3),
    "doctorOpinion" TEXT, "doctorUserId" TEXT, "doctorReviewedAt" TIMESTAMP(3),
    "committeeHeadOpinion" TEXT, "committeeHeadUserId" TEXT, "committeeHeadReviewedAt" TIMESTAMP(3),
    "expertOpinion" TEXT, "expertUserId" TEXT, "expertReviewedAt" TIMESTAMP(3),
    "finalDecision" "clinic_prosthetics"."CommitteeDecision",
    "finalSummary" TEXT,
    "decidedAt" TIMESTAMP(3),
    "doctorSignatureBase64" TEXT, "doctorSignedAt" TIMESTAMP(3), "doctorSignatureIp" TEXT,
    CONSTRAINT "committee_reviews_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "committee_reviews_caseId_key" ON "clinic_prosthetics"."committee_reviews"("caseId");

-- CreateTable: prosthesis_components
CREATE TABLE "clinic_prosthetics"."prosthesis_components" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "partCode" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "sourceLocation" "clinic_prosthetics"."ComponentSource" NOT NULL,
    "reason" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedBy" TEXT NOT NULL,
    CONSTRAINT "prosthesis_components_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "prosthesis_components_caseId_idx" ON "clinic_prosthetics"."prosthesis_components"("caseId");

-- CreateTable: gait_analyses
CREATE TABLE "clinic_prosthetics"."gait_analyses" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "suspensionSystem" "clinic_prosthetics"."SuspensionSystem"[],
    "socketBearing" "clinic_prosthetics"."SocketBearing",
    "kneeJointType" "clinic_prosthetics"."KneeJointType",
    "footType" "clinic_prosthetics"."FootType",
    "socketPain" BOOLEAN NOT NULL DEFAULT false,
    "residualLimbPain" BOOLEAN NOT NULL DEFAULT false,
    "painIntensity" INTEGER,
    "alignmentCheck" "clinic_prosthetics"."AlignmentStatus",
    "hasRomLimitations" BOOLEAN NOT NULL DEFAULT false,
    "hasHipFlexionContracture" BOOLEAN NOT NULL DEFAULT false,
    "hasKneeFlexionContracture" BOOLEAN NOT NULL DEFAULT false,
    "weakHipAbductors" BOOLEAN NOT NULL DEFAULT false,
    "weakHipExtensors" BOOLEAN NOT NULL DEFAULT false,
    "weakTrunkMuscles" BOOLEAN NOT NULL DEFAULT false,
    "otherWeakness" TEXT,
    "trunkStability" "clinic_prosthetics"."QualityLevel",
    "abdominalControl" "clinic_prosthetics"."QualityLevel",
    "pelvicControl" "clinic_prosthetics"."QualityLevel",
    "sittingBalance" "clinic_prosthetics"."IndependenceLevel",
    "standingBalance" "clinic_prosthetics"."StabilityLevel",
    "assistiveDevice" "clinic_prosthetics"."AssistiveDevice",
    "speedMs" DOUBLE PRECISION,
    "cadence" INTEGER,
    "stepLengthProsCm" DOUBLE PRECISION,
    "stepLengthSoundCm" DOUBLE PRECISION,
    "stancePercProsthetic" DOUBLE PRECISION,
    "stancePercSound" DOUBLE PRECISION,
    "symmetry" "clinic_prosthetics"."QualityLevel",
    "deviations" JSONB NOT NULL DEFAULT '{}',
    "mainProblem" TEXT,
    "notes" TEXT,
    "examinerProsthetistId" TEXT NOT NULL,
    "examinerPhysioId" TEXT NOT NULL,
    "examinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedByDoctorId" TEXT,
    "doctorSignatureBase64" TEXT,
    "doctorSignedAt" TIMESTAMP(3),
    CONSTRAINT "gait_analyses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "gait_analyses_caseId_key" ON "clinic_prosthetics"."gait_analyses"("caseId");

-- CreateTable: balance_assessments
CREATE TABLE "clinic_prosthetics"."balance_assessments" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "staticResults" JSONB NOT NULL DEFAULT '{}',
    "dynamicResults" JSONB NOT NULL DEFAULT '{}',
    "activityResults" JSONB NOT NULL DEFAULT '{}',
    "historyOfFalls" BOOLEAN NOT NULL DEFAULT false,
    "nearFalls" BOOLEAN NOT NULL DEFAULT false,
    "fearOfFalling" BOOLEAN NOT NULL DEFAULT false,
    "fallRiskLevel" "clinic_prosthetics"."FallRiskLevel",
    "overallBalanceLevel" "clinic_prosthetics"."QualityLevel",
    "exerciseProgram" JSONB NOT NULL DEFAULT '[]',
    "homeExerciseProgram" BOOLEAN NOT NULL DEFAULT false,
    "followUpWeeks" INTEGER,
    "examinerPhysioId" TEXT NOT NULL,
    "committeeHeadId" TEXT,
    "examinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "balance_assessments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "balance_assessments_caseId_key" ON "clinic_prosthetics"."balance_assessments"("caseId");

-- CreateTable: treatment_plans
CREATE TABLE "clinic_prosthetics"."treatment_plans" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "notes" TEXT,
    CONSTRAINT "treatment_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "treatment_plans_caseId_key" ON "clinic_prosthetics"."treatment_plans"("caseId");

-- CreateTable: workshop_sessions
CREATE TABLE "clinic_prosthetics"."workshop_sessions" (
    "id" TEXT NOT NULL, "planId" TEXT NOT NULL, "sessionDate" TIMESTAMP(3) NOT NULL,
    "sessionTime" TEXT, "providedService" TEXT NOT NULL, "notes" TEXT, "technicianId" TEXT NOT NULL,
    CONSTRAINT "workshop_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: pt_sessions
CREATE TABLE "clinic_prosthetics"."pt_sessions" (
    "id" TEXT NOT NULL, "planId" TEXT NOT NULL, "sessionDate" TIMESTAMP(3) NOT NULL,
    "sessionTime" TEXT, "providedService" TEXT NOT NULL, "notes" TEXT, "physiotherapistId" TEXT NOT NULL,
    CONSTRAINT "pt_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: media_sessions
CREATE TABLE "clinic_prosthetics"."media_sessions" (
    "id" TEXT NOT NULL, "planId" TEXT NOT NULL, "sessionDate" TIMESTAMP(3) NOT NULL,
    "sessionTime" TEXT, "providedService" TEXT NOT NULL, "notes" TEXT, "supervisorId" TEXT NOT NULL,
    CONSTRAINT "media_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: consumable_usages
CREATE TABLE "clinic_prosthetics"."consumable_usages" (
    "id" TEXT NOT NULL, "caseId" TEXT NOT NULL, "inventoryItemId" TEXT NOT NULL,
    "consumableName" TEXT NOT NULL, "quantity" DOUBLE PRECISION NOT NULL, "unit" TEXT NOT NULL,
    "notes" TEXT, "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedBy" TEXT NOT NULL, "supervisorId" TEXT NOT NULL,
    CONSTRAINT "consumable_usages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "consumable_usages_caseId_idx" ON "clinic_prosthetics"."consumable_usages"("caseId");

-- CreateTable: final_evaluations
CREATE TABLE "clinic_prosthetics"."final_evaluations" (
    "id" TEXT NOT NULL, "caseId" TEXT NOT NULL,
    "residualLimbCondition" TEXT, "suspensionSystemUsed" TEXT,
    "socksDelivered" INTEGER, "linersDelivered" INTEGER,
    "fittingDate" TIMESTAMP(3), "generalNotes" TEXT, "supervisorId" TEXT NOT NULL,
    "physioOpinion" TEXT, "prosthetistOpinion" TEXT, "prosthetistSupervisorOpinion" TEXT,
    "committeeHeadOpinion" TEXT, "expertOpinion" TEXT,
    "readyForDelivery" BOOLEAN NOT NULL DEFAULT false,
    "needsFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "followUpPlan" TEXT,
    "medicalDirectorSignatureBase64" TEXT, "medicalDirectorSignedAt" TIMESTAMP(3), "medicalDirectorIp" TEXT,
    "patientFileComplete" BOOLEAN NOT NULL DEFAULT false,
    "managerNotes" TEXT, "managerSignatureBase64" TEXT, "managerSignedAt" TIMESTAMP(3),
    CONSTRAINT "final_evaluations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "final_evaluations_caseId_key" ON "clinic_prosthetics"."final_evaluations"("caseId");

-- CreateTable: deliveries
CREATE TABLE "clinic_prosthetics"."deliveries" (
    "id" TEXT NOT NULL, "caseId" TEXT NOT NULL,
    "deliveryDate" TIMESTAMP(3) NOT NULL, "prosthetistId" TEXT NOT NULL, "physiotherapistId" TEXT NOT NULL,
    "deliveredItems" JSONB NOT NULL DEFAULT '[]',
    "patientSignatureBase64" TEXT, "patientSignedAt" TIMESTAMP(3),
    "managerId" TEXT NOT NULL, "managerSignatureBase64" TEXT, "managerSignedAt" TIMESTAMP(3),
    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "deliveries_caseId_key" ON "clinic_prosthetics"."deliveries"("caseId");

-- CreateTable: follow_ups
CREATE TABLE "clinic_prosthetics"."follow_ups" (
    "id" TEXT NOT NULL, "caseId" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL, "findings" TEXT NOT NULL,
    "actions" TEXT, "practitionerId" TEXT NOT NULL,
    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "follow_ups_caseId_idx" ON "clinic_prosthetics"."follow_ups"("caseId");

-- AddForeignKeys
ALTER TABLE "clinic_prosthetics"."upper_limb_assessments" ADD CONSTRAINT "upper_limb_assessments_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "clinic_prosthetics"."prosthetics_cases"("id") ON DELETE CASCADE;
ALTER TABLE "clinic_prosthetics"."lower_limb_assessments" ADD CONSTRAINT "lower_limb_assessments_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "clinic_prosthetics"."prosthetics_cases"("id") ON DELETE CASCADE;
ALTER TABLE "clinic_prosthetics"."committee_reviews" ADD CONSTRAINT "committee_reviews_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "clinic_prosthetics"."prosthetics_cases"("id") ON DELETE CASCADE;
ALTER TABLE "clinic_prosthetics"."prosthesis_components" ADD CONSTRAINT "prosthesis_components_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "clinic_prosthetics"."prosthetics_cases"("id") ON DELETE CASCADE;
ALTER TABLE "clinic_prosthetics"."gait_analyses" ADD CONSTRAINT "gait_analyses_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "clinic_prosthetics"."prosthetics_cases"("id") ON DELETE CASCADE;
ALTER TABLE "clinic_prosthetics"."balance_assessments" ADD CONSTRAINT "balance_assessments_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "clinic_prosthetics"."prosthetics_cases"("id") ON DELETE CASCADE;
ALTER TABLE "clinic_prosthetics"."treatment_plans" ADD CONSTRAINT "treatment_plans_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "clinic_prosthetics"."prosthetics_cases"("id") ON DELETE CASCADE;
ALTER TABLE "clinic_prosthetics"."workshop_sessions" ADD CONSTRAINT "workshop_sessions_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "clinic_prosthetics"."treatment_plans"("id") ON DELETE CASCADE;
ALTER TABLE "clinic_prosthetics"."pt_sessions" ADD CONSTRAINT "pt_sessions_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "clinic_prosthetics"."treatment_plans"("id") ON DELETE CASCADE;
ALTER TABLE "clinic_prosthetics"."media_sessions" ADD CONSTRAINT "media_sessions_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "clinic_prosthetics"."treatment_plans"("id") ON DELETE CASCADE;
ALTER TABLE "clinic_prosthetics"."consumable_usages" ADD CONSTRAINT "consumable_usages_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "clinic_prosthetics"."prosthetics_cases"("id") ON DELETE CASCADE;
ALTER TABLE "clinic_prosthetics"."final_evaluations" ADD CONSTRAINT "final_evaluations_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "clinic_prosthetics"."prosthetics_cases"("id") ON DELETE CASCADE;
ALTER TABLE "clinic_prosthetics"."deliveries" ADD CONSTRAINT "deliveries_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "clinic_prosthetics"."prosthetics_cases"("id") ON DELETE CASCADE;
ALTER TABLE "clinic_prosthetics"."follow_ups" ADD CONSTRAINT "follow_ups_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "clinic_prosthetics"."prosthetics_cases"("id") ON DELETE CASCADE;
