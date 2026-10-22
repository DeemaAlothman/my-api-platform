ALTER TABLE "clinic_orthotics"."orthotics_receptions"
  ADD COLUMN "appliancesCount" INTEGER,
  ADD COLUMN "affectedLimbType" TEXT,
  ADD COLUMN "affectedSide" TEXT,
  ADD COLUMN "soundLimbDescription" TEXT;
