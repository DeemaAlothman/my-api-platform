-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "clinic_orthotics";

-- CreateTable
CREATE TABLE "clinic_orthotics"."orthotics_receptions" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,

    "guardianName" TEXT,
    "guardianRelation" TEXT,
    "guardianPhone" TEXT,

    "diagnosisTypes" TEXT[],
    "cerebralPalsyType" TEXT,
    "footDropCause" TEXT,
    "diagnosisOther" TEXT,
    "injuryStartDate" TEXT,
    "surgicalHistory" TEXT,
    "familyHistory" TEXT,
    "chiefComplaint" TEXT,

    "muscleTone" TEXT,
    "spasticityLevel" TEXT,
    "sensation" TEXT,
    "thighMuscleStrength" TEXT,
    "legFootMuscleStrength" TEXT,
    "skinConditions" TEXT[],
    "pressurePointsLocation" TEXT,

    "doctorAssessmentUpdatedAt" TIMESTAMP(3),
    "doctorAssessmentUpdatedBy" TEXT,

    "mobilityLevel" TEXT,
    "assistiveDevices" TEXT[],
    "gaitProblems" TEXT[],

    "hipROM" TEXT,
    "kneeROM" TEXT,
    "ankleROM" TEXT,

    "muscleStrengthMovements" TEXT[],
    "deformityFlexibility" TEXT,
    "deformityStatus" TEXT,

    "trunkStrengthMovements" TEXT[],
    "trunkControlSitting" TEXT,
    "trunkBalanceDynamicSitting" TEXT,
    "trunkControlStanding" TEXT,
    "trunkBalanceStaticStanding" TEXT,
    "trunkBalanceDynamicStanding" TEXT,

    "activityLevel" TEXT,

    "physioAssessmentUpdatedAt" TIMESTAMP(3),
    "physioAssessmentUpdatedBy" TEXT,

    "doctorOpinion" TEXT,
    "physioOpinion" TEXT,
    "prosthetistOpinion" TEXT,

    "practitionerIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "orthotics_receptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orthotics_receptions_patientId_idx" ON "clinic_orthotics"."orthotics_receptions"("patientId");
