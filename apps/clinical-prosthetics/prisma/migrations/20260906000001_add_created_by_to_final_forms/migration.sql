-- AlterTable: add createdBy to final_delivery_forms
ALTER TABLE "clinic_prosthetics"."final_delivery_forms" ADD COLUMN "createdBy" TEXT;

-- AlterTable: add createdBy to final_evaluations
ALTER TABLE "clinic_prosthetics"."final_evaluations" ADD COLUMN "createdBy" TEXT;
