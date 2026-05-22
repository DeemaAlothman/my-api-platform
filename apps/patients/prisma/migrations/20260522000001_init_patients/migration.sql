-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "clinic_patients";

-- CreateEnum
CREATE TYPE "IdType" AS ENUM ('NATIONAL_ID', 'PASSPORT', 'UNHCR', 'OTHER');
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');
CREATE TYPE "EducationLevel" AS ENUM ('ILLITERATE', 'PRIMARY', 'SECONDARY', 'HIGH_SCHOOL', 'UNIVERSITY', 'POSTGRADUATE');
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED');
CREATE TYPE "LivingCondition" AS ENUM ('WITH_FAMILY', 'INDEPENDENT', 'SHELTER_CAMP', 'OTHER');
CREATE TYPE "FinancialStatus" AS ENUM ('LOW', 'MODERATE', 'GOOD', 'NOT_WORKING', 'RETIRED');
CREATE TYPE "ReferralSource" AS ENUM ('SELF', 'RELATIVES', 'SOCIAL_MEDIA', 'MEDICAL_REFERRAL', 'OTHER');
CREATE TYPE "DocumentType" AS ENUM ('ID_COPY', 'PERSONAL_PHOTO', 'AMPUTATION_PHOTO', 'RESIDUAL_LIMB_PHOTO', 'MEDICAL_REPORT', 'OTHER');
CREATE TYPE "ConsentType" AS ENUM ('DOCUMENTATION', 'MEDIA_APPEARANCE');
CREATE TYPE "ConsentDecision" AS ENUM ('FUNDER_ONLY', 'FUNDER_AND_SOCIAL', 'REFUSED', 'AGREED', 'DISAGREED');

-- CreateTable cities
CREATE TABLE "clinic_patients"."cities" (
    "id"          SERIAL NOT NULL,
    "nameAr"      TEXT NOT NULL,
    "nameEn"      TEXT NOT NULL,
    "governorate" TEXT NOT NULL,
    CONSTRAINT "cities_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cities_nameAr_governorate_key" UNIQUE ("nameAr", "governorate")
);

-- CreateTable patients
CREATE TABLE "clinic_patients"."patients" (
    "id"              TEXT NOT NULL,
    "patientNumber"   TEXT NOT NULL,
    "firstName"       TEXT NOT NULL,
    "lastName"        TEXT NOT NULL,
    "idType"          "IdType" NOT NULL,
    "idNumber"        TEXT NOT NULL,
    "dateOfBirth"     TIMESTAMP(3) NOT NULL,
    "gender"          "Gender" NOT NULL,
    "cityId"          INTEGER NOT NULL,
    "addressDetails"  TEXT,
    "phone"           TEXT NOT NULL,
    "whatsapp"        TEXT,
    "email"           TEXT,
    "heightCm"        DOUBLE PRECISION,
    "weightKg"        DOUBLE PRECISION,
    "bmi"             DOUBLE PRECISION,
    "educationLevel"  "EducationLevel",
    "maritalStatus"   "MaritalStatus",
    "livingCondition" "LivingCondition",
    "financialStatus" "FinancialStatus",
    "receivesAid"     BOOLEAN NOT NULL DEFAULT false,
    "referralSource"  "ReferralSource",
    "referralDetails" TEXT,
    "deletedAt"       TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    "createdBy"       TEXT NOT NULL,
    CONSTRAINT "patients_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "patients_patientNumber_key" UNIQUE ("patientNumber"),
    CONSTRAINT "patients_idNumber_key" UNIQUE ("idNumber"),
    CONSTRAINT "patients_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "clinic_patients"."cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "patients_idNumber_idx" ON "clinic_patients"."patients"("idNumber");
CREATE INDEX "patients_patientNumber_idx" ON "clinic_patients"."patients"("patientNumber");
CREATE INDEX "patients_phone_idx" ON "clinic_patients"."patients"("phone");

-- CreateTable patient_documents
CREATE TABLE "clinic_patients"."patient_documents" (
    "id"         TEXT NOT NULL,
    "patientId"  TEXT NOT NULL,
    "type"       "DocumentType" NOT NULL,
    "fileName"   TEXT NOT NULL,
    "filePath"   TEXT NOT NULL,
    "fileSize"   INTEGER NOT NULL,
    "mimeType"   TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT NOT NULL,
    CONSTRAINT "patient_documents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "patient_documents_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "clinic_patients"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "patient_documents_patientId_idx" ON "clinic_patients"."patient_documents"("patientId");

-- CreateTable consents
CREATE TABLE "clinic_patients"."consents" (
    "id"              TEXT NOT NULL,
    "patientId"       TEXT NOT NULL,
    "type"            "ConsentType" NOT NULL,
    "decision"        "ConsentDecision" NOT NULL,
    "signatureBase64" TEXT,
    "signedAt"        TIMESTAMP(3),
    "signedByPatient" TEXT NOT NULL,
    "witnessUserId"   TEXT,
    "ipAddress"       TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "consents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "consents_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "clinic_patients"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "consents_patientId_idx" ON "clinic_patients"."consents"("patientId");

-- CreateTable patient_notes
CREATE TABLE "clinic_patients"."patient_notes" (
    "id"        TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "authorId"  TEXT NOT NULL,
    "body"      TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "patient_notes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "patient_notes_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "clinic_patients"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "patient_notes_patientId_idx" ON "clinic_patients"."patient_notes"("patientId");
