-- CreateEnum
CREATE TYPE "PodiatryNoFittingReason" AS ENUM ('TIMING', 'PRICE', 'OTHER');

-- AlterTable
ALTER TABLE "patient_surveys"
  ADD COLUMN "noFittingReason" "PodiatryNoFittingReason",
  ADD COLUMN "insoleComfortRating" INTEGER;
