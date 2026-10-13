-- CreateEnum
CREATE TYPE "SurveyDepartment" AS ENUM ('PROSTHETICS', 'PODIATRY', 'PHYSIO');

-- CreateEnum
CREATE TYPE "SurveyAgeGroup" AS ENUM ('UNDER_18', 'FROM_18_25', 'FROM_26_30', 'FROM_31_40', 'FROM_41_50', 'FROM_51_60', 'OVER_60');

-- CreateEnum
CREATE TYPE "SurveyComplaintStage" AS ENUM ('ASSESSMENT', 'MEASUREMENT', 'TRAINING_REHAB', 'SOCKET_FITTING', 'NONE');

-- CreateEnum
CREATE TYPE "PodiatryServiceType" AS ENUM ('ANALYSIS_ONLY', 'ANALYSIS_AND_FITTING');

-- CreateTable
CREATE TABLE "patient_surveys" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "department" "SurveyDepartment" NOT NULL,
    "caseId" TEXT,
    "practitionerIds" TEXT[],
    "customerName" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "ageGroup" "SurveyAgeGroup" NOT NULL,
    "staffExplanationRating" INTEGER,
    "specialistCareRating" INTEGER,
    "waitingAreaRating" INTEGER,
    "waitingDurationRating" INTEGER,
    "overallCompanyRating" INTEGER NOT NULL,
    "measurementAccuracyRating" INTEGER,
    "movementEaseRating" INTEGER,
    "complaintStage" "SurveyComplaintStage",
    "podiatryServiceType" "PodiatryServiceType",
    "medicalRecommendationRating" INTEGER,
    "exerciseQualityRating" INTEGER,
    "mobilityImprovementRating" INTEGER,
    "additionalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,

    CONSTRAINT "patient_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patient_surveys_patientId_idx" ON "patient_surveys"("patientId");

-- CreateIndex
CREATE INDEX "patient_surveys_department_idx" ON "patient_surveys"("department");

-- AddForeignKey
ALTER TABLE "patient_surveys" ADD CONSTRAINT "patient_surveys_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
