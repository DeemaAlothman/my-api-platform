-- ============================================================
-- Migration: Contract types, qualifications, allowances
-- ============================================================
SET search_path TO users;

-- 1. تعديل ContractType: إعادة إنشاء الـ enum كاملاً
-- (لا نستخدم ADD VALUE + use في نفس الـ transaction لتجنب خطأ 55P04)
ALTER TABLE employees ALTER COLUMN "contractType" TYPE TEXT;
DROP TYPE "ContractType";
CREATE TYPE "ContractType" AS ENUM ('FIXED_TERM', 'INDEFINITE', 'TEMPORARY', 'TRAINEE');
ALTER TABLE employees ALTER COLUMN "contractType" TYPE "ContractType" USING "contractType"::"ContractType";

-- 2. إضافة حقول المؤهلات والشهادات على جدول employees
ALTER TABLE employees
  ADD COLUMN "yearsOfExperience"      INTEGER,
  ADD COLUMN "certificate1"           TEXT,
  ADD COLUMN "specialization1"        TEXT,
  ADD COLUMN "certificateAttachment1" TEXT,
  ADD COLUMN "certificate2"           TEXT,
  ADD COLUMN "specialization2"        TEXT,
  ADD COLUMN "certificateAttachment2" TEXT;

-- 3. جدول الشهادات التدريبية
CREATE TABLE training_certificates (
  "id"            TEXT NOT NULL,
  "employeeId"    TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "attachmentUrl" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "training_certificates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "training_certificates_employeeId_idx" ON training_certificates("employeeId");
ALTER TABLE training_certificates
  ADD CONSTRAINT "training_certificates_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES employees("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. enum البدلات وجدول بدلات الموظفين
CREATE TYPE "AllowanceType" AS ENUM ('MEDICAL', 'EXPERIENCE', 'HIGHER_DEGREE', 'WORK_NATURE', 'RESPONSIBILITY');
CREATE TABLE employee_allowances (
  "id"         TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "type"       "AllowanceType" NOT NULL,
  "amount"     DECIMAL(15,2) NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_allowances_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "employee_allowances_employeeId_idx" ON employee_allowances("employeeId");
ALTER TABLE employee_allowances
  ADD CONSTRAINT "employee_allowances_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES employees("id") ON DELETE CASCADE ON UPDATE CASCADE;
