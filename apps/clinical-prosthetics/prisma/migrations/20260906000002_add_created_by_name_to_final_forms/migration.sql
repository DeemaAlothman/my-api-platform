-- AlterTable: add createdByName to final_delivery_forms
ALTER TABLE "clinic_prosthetics"."final_delivery_forms" ADD COLUMN "createdByName" TEXT;

-- AlterTable: add createdByName to final_evaluations
ALTER TABLE "clinic_prosthetics"."final_evaluations" ADD COLUMN "createdByName" TEXT;
