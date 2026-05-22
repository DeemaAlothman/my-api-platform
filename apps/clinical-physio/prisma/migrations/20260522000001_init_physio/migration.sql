-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "clinic_physio";

-- CreateEnum
CREATE TYPE "clinic_physio"."LifeType" AS ENUM ('PROFESSIONAL', 'NORMAL', 'SEDENTARY', 'ABNORMAL');
CREATE TYPE "clinic_physio"."PainLevel" AS ENUM ('MILD', 'MODERATE', 'SEVERE', 'EXCRUCIATING');
CREATE TYPE "clinic_physio"."PainDuration" AS ENUM ('INTERMITTENT', 'CONSTANT', 'WITH_CERTAIN_MOTIONS');
CREATE TYPE "clinic_physio"."PhysioPainType" AS ENUM ('NUMBNESS', 'DULL_ACHE', 'HOT_BURNING', 'SHARP_STABBING', 'PINS', 'OTHER');
CREATE TYPE "clinic_physio"."PainFactor" AS ENUM ('SITTING', 'HEAT', 'COLD', 'COUGHING', 'WALKING', 'EXERCISE', 'LYING_DOWN', 'OTHER');
CREATE TYPE "clinic_physio"."PhysioStatus" AS ENUM ('INTAKE', 'ASSESSMENT', 'PLAN_REVIEW', 'ACTIVE_TREATMENT', 'COMPLETED', 'DISCHARGED');
CREATE TYPE "clinic_physio"."ChronicCondition" AS ENUM ('AIDS_HIV', 'MULTIPLE_SCLEROSIS', 'LIVER_PROBLEMS', 'ARTHRITIS', 'STDS', 'PNEUMONIA', 'CANCER', 'ANGINA', 'URINARY_INFECTION', 'DIABETES', 'BLOOD_CLOTS', 'HEMOPHILIA', 'CIRCULATION_PROBLEMS', 'LUNG_ISSUES', 'EYE_INFECTION', 'STROKE', 'JOINT_BONE_INFECTION', 'KIDNEY_PROBLEMS', 'MUSCULOSKELETAL', 'ANEMIA', 'TUBERCULOSIS', 'ASTHMA', 'ARTERIOSCLEROSIS', 'CHEMICAL_DEPENDENCY', 'BONE_INFECTION', 'EPILEPSY', 'DEPRESSION', 'HEART_PROBLEMS', 'HYPERTENSION', 'OTHER');
CREATE TYPE "clinic_physio"."MedicalTest" AS ENUM ('MRI', 'XRAY', 'CT', 'MYELOGRAM', 'OTHER');
CREATE TYPE "clinic_physio"."PhysioGoal" AS ENUM ('BACK_TO_SPORTS', 'BACK_TO_WORK', 'SIMPLE_WORKS', 'PAIN_RELIEF', 'OTHER');
CREATE TYPE "clinic_physio"."TherapyModality" AS ENUM ('ESWT', 'US', 'TENS', 'EMS', 'LASER', 'CPM', 'HOT_PACKS', 'COLD_PACKS', 'TRACTION', 'EXERCISES', 'MANUAL_THERAPY', 'MASSAGE', 'KINESIO_TAPING', 'COMPRESSION', 'PARAFFIN', 'GRASTON', 'MET', 'PNF', 'INFRARED', 'OTHER');
CREATE TYPE "clinic_physio"."PlanStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable physio_cases
CREATE TABLE "clinic_physio"."physio_cases" (
    "id" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "currentJob" TEXT,
    "lifeType" "clinic_physio"."LifeType",
    "majorComplaint" TEXT NOT NULL,
    "symptoms" TEXT NOT NULL,
    "complaintStartDate" TIMESTAMP(3),
    "possibleCause" TEXT,
    "previousDoctorSeen" TEXT,
    "previousTreatment" TEXT,
    "hadPreviousPT" BOOLEAN NOT NULL DEFAULT false,
    "hadPreviousInjury" BOOLEAN NOT NULL DEFAULT false,
    "painStartDate" TIMESTAMP(3),
    "painLevel" "clinic_physio"."PainLevel",
    "painDuration" "clinic_physio"."PainDuration",
    "painProgression" TEXT,
    "bestTimeOfDay" TEXT,
    "worstTimeOfDay" TEXT,
    "painTypes" "clinic_physio"."PhysioPainType"[] DEFAULT ARRAY[]::"clinic_physio"."PhysioPainType"[],
    "aggravatingFactors" "clinic_physio"."PainFactor"[] DEFAULT ARRAY[]::"clinic_physio"."PainFactor"[],
    "aggravatingOther" TEXT,
    "alleviatingFactors" "clinic_physio"."PainFactor"[] DEFAULT ARRAY[]::"clinic_physio"."PainFactor"[],
    "alleviatingOther" TEXT,
    "status" "clinic_physio"."PhysioStatus" NOT NULL DEFAULT 'INTAKE',
    "physiotherapistId" TEXT,
    "supervisingDoctorId" TEXT,
    "caseManagerId" TEXT,
    "treatmentFrom" TIMESTAMP(3),
    "treatmentTo" TIMESTAMP(3),
    "anticipatedVisits" INTEGER,
    "finalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "physio_cases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "physio_cases_caseNumber_key" ON "clinic_physio"."physio_cases"("caseNumber");
CREATE INDEX "physio_cases_patientId_idx" ON "clinic_physio"."physio_cases"("patientId");
CREATE INDEX "physio_cases_status_idx" ON "clinic_physio"."physio_cases"("status");
CREATE INDEX "physio_cases_caseNumber_idx" ON "clinic_physio"."physio_cases"("caseNumber");

-- CreateTable pain_maps
CREATE TABLE "clinic_physio"."pain_maps" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "regions" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    CONSTRAINT "pain_maps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pain_maps_caseId_key" ON "clinic_physio"."pain_maps"("caseId");

-- CreateTable medical_histories
CREATE TABLE "clinic_physio"."medical_histories" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "smokes" BOOLEAN NOT NULL DEFAULT false,
    "hasSmokedBefore" BOOLEAN NOT NULL DEFAULT false,
    "smokingFrequency" TEXT,
    "hasPacemaker" BOOLEAN NOT NULL DEFAULT false,
    "allergies" TEXT,
    "adhesiveAllergy" BOOLEAN NOT NULL DEFAULT false,
    "currentMedications" TEXT,
    "prescriptionDrugs" BOOLEAN NOT NULL DEFAULT false,
    "herbalSupplements" BOOLEAN NOT NULL DEFAULT false,
    "supplementsList" TEXT,
    "isPregnant" BOOLEAN NOT NULL DEFAULT false,
    "previousDiagnoses" TEXT,
    "chronicConditions" "clinic_physio"."ChronicCondition"[] DEFAULT ARRAY[]::"clinic_physio"."ChronicCondition"[],
    "otherConditions" TEXT,
    "doctorRestrictions" TEXT,
    "testsHad" "clinic_physio"."MedicalTest"[] DEFAULT ARRAY[]::"clinic_physio"."MedicalTest"[],
    "testsOther" TEXT,
    "testResults" TEXT,
    "newAnalysis" TEXT,
    "newAnalysisDate" TIMESTAMP(3),
    "oldAnalysis" TEXT,
    "oldAnalysisDate" TIMESTAMP(3),
    "hospitalizedLastYear" BOOLEAN NOT NULL DEFAULT false,
    "receivingOtherTreatment" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "medical_histories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "medical_histories_caseId_key" ON "clinic_physio"."medical_histories"("caseId");

-- CreateTable surgeries
CREATE TABLE "clinic_physio"."surgeries" (
    "id" TEXT NOT NULL,
    "historyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "type" TEXT,
    "order" INTEGER NOT NULL,
    CONSTRAINT "surgeries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "surgeries_historyId_idx" ON "clinic_physio"."surgeries"("historyId");

-- CreateTable treatment_goals
CREATE TABLE "clinic_physio"."treatment_goals" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "goals" "clinic_physio"."PhysioGoal"[] DEFAULT ARRAY[]::"clinic_physio"."PhysioGoal"[],
    "customGoal" TEXT,
    "decreasePain" BOOLEAN NOT NULL DEFAULT false,
    "improveStrength" BOOLEAN NOT NULL DEFAULT false,
    "lessDifficultyWork" BOOLEAN NOT NULL DEFAULT false,
    "standLongerMinutes" INTEGER,
    "sleepLongerMinutes" INTEGER,
    "sitLongerMinutes" INTEGER,
    "improveMovement" BOOLEAN NOT NULL DEFAULT false,
    "otherGoals" TEXT,
    CONSTRAINT "treatment_goals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "treatment_goals_caseId_key" ON "clinic_physio"."treatment_goals"("caseId");

-- CreateTable postural_assessments
CREATE TABLE "clinic_physio"."postural_assessments" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "seatedPosition" TEXT,
    "trunkControl" TEXT,
    "head" JSONB NOT NULL DEFAULT '{}',
    "shoulders" JSONB NOT NULL DEFAULT '{}',
    "elbow" JSONB NOT NULL DEFAULT '{}',
    "ribCage" JSONB NOT NULL DEFAULT '{}',
    "spine" JSONB NOT NULL DEFAULT '{}',
    "pelvis" JSONB NOT NULL DEFAULT '{}',
    "hips" JSONB NOT NULL DEFAULT '{}',
    "knees" JSONB NOT NULL DEFAULT '{}',
    "feet" JSONB NOT NULL DEFAULT '{}',
    "spasticityNotes" TEXT,
    "generalNotes" TEXT,
    "diagnosis" TEXT,
    CONSTRAINT "postural_assessments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "postural_assessments_caseId_key" ON "clinic_physio"."postural_assessments"("caseId");

-- CreateTable physio_treatment_plans
CREATE TABLE "clinic_physio"."physio_treatment_plans" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "modalities" "clinic_physio"."TherapyModality"[] DEFAULT ARRAY[]::"clinic_physio"."TherapyModality"[],
    "otherModality" TEXT,
    "remarks" TEXT,
    "observation" TEXT,
    "supervisorGaze" TEXT,
    "supervisorId" TEXT,
    "supervisorReviewedAt" TIMESTAMP(3),
    "doctorGaze" TEXT,
    "doctorId" TEXT,
    "doctorReviewedAt" TIMESTAMP(3),
    "doctorSignatureBase64" TEXT,
    "status" "clinic_physio"."PlanStatus" NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT "physio_treatment_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "physio_treatment_plans_caseId_key" ON "clinic_physio"."physio_treatment_plans"("caseId");

-- CreateTable physio_sessions
CREATE TABLE "clinic_physio"."physio_sessions" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "sessionTime" TEXT,
    "modalities" "clinic_physio"."TherapyModality"[] DEFAULT ARRAY[]::"clinic_physio"."TherapyModality"[],
    "notes" TEXT,
    "physiotherapistId" TEXT NOT NULL,
    "painLevel" INTEGER,
    "romMeasurements" JSONB,
    "attendanceConfirmed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "physio_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "physio_sessions_caseId_idx" ON "clinic_physio"."physio_sessions"("caseId");
CREATE INDEX "physio_sessions_sessionDate_idx" ON "clinic_physio"."physio_sessions"("sessionDate");

-- AddForeignKey
ALTER TABLE "clinic_physio"."pain_maps" ADD CONSTRAINT "pain_maps_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "clinic_physio"."physio_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clinic_physio"."medical_histories" ADD CONSTRAINT "medical_histories_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "clinic_physio"."physio_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clinic_physio"."surgeries" ADD CONSTRAINT "surgeries_historyId_fkey" FOREIGN KEY ("historyId") REFERENCES "clinic_physio"."medical_histories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clinic_physio"."treatment_goals" ADD CONSTRAINT "treatment_goals_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "clinic_physio"."physio_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clinic_physio"."postural_assessments" ADD CONSTRAINT "postural_assessments_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "clinic_physio"."physio_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clinic_physio"."physio_treatment_plans" ADD CONSTRAINT "physio_treatment_plans_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "clinic_physio"."physio_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clinic_physio"."physio_sessions" ADD CONSTRAINT "physio_sessions_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "clinic_physio"."physio_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
