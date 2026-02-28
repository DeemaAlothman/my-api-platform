-- AlterTable
ALTER TABLE "users"."employees"
  ADD COLUMN "basicSalary" DECIMAL(15,2),
  ADD COLUMN "salaryCurrency" TEXT DEFAULT 'SYP';
