-- AlterTable
ALTER TABLE "clinic_orthotics"."orthotics_receptions"
  ADD COLUMN "birthHistory" TEXT,
  ADD COLUMN "previousOrthosisUse" BOOLEAN,
  ADD COLUMN "previousOrthosisDetails" TEXT,
  ADD COLUMN "medicalHistory" TEXT,
  ADD COLUMN "functionalGoals" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "dailyUseSettings" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "dailyUseOther" TEXT,
  ADD COLUMN "recommendedDeviceTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "recommendedDeviceOther" TEXT,
  ADD COLUMN "dailyWearHours" DOUBLE PRECISION,
  ADD COLUMN "additionalNotes" TEXT;
