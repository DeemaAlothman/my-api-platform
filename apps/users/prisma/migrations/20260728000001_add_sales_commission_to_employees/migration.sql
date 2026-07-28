-- AlterTable: add optional salesCommission field to employees
ALTER TABLE "users"."employees" ADD COLUMN "salesCommission" DECIMAL(15,2);
