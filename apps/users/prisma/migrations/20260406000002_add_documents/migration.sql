-- CreateEnum
CREATE TYPE "users"."DocumentType" AS ENUM (
  'CONTRACT',
  'NATIONAL_ID',
  'PASSPORT',
  'RESIDENCE',
  'CERTIFICATE',
  'PHOTO',
  'MEDICAL',
  'BANK_ACCOUNT',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "users"."DocumentStatus" AS ENUM (
  'ACTIVE',
  'EXPIRED',
  'CANCELLED'
);

-- CreateTable
CREATE TABLE "users"."employee_documents" (
  "id"         TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "type"       "users"."DocumentType" NOT NULL,
  "status"     "users"."DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
  "titleAr"    TEXT NOT NULL,
  "titleEn"    TEXT,
  "notes"      TEXT,
  "fileUrl"    TEXT NOT NULL,
  "fileName"   TEXT NOT NULL,
  "fileSize"   INTEGER,
  "mimeType"   TEXT,
  "issueDate"  TIMESTAMP(3),
  "expiryDate" TIMESTAMP(3),
  "uploadedBy" TEXT,
  "deletedAt"  TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT NOW(),

  CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_documents_employeeId_idx" ON "users"."employee_documents"("employeeId");
CREATE INDEX "employee_documents_expiryDate_idx" ON "users"."employee_documents"("expiryDate");
CREATE INDEX "employee_documents_status_idx"    ON "users"."employee_documents"("status");

-- AddForeignKey
ALTER TABLE "users"."employee_documents"
  ADD CONSTRAINT "employee_documents_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "users"."employees"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
