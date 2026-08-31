ALTER TABLE "clinic_prosthetics"."prosthetics_cases" ADD COLUMN "prosthetistIds"       TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "clinic_prosthetics"."prosthetics_cases" ADD COLUMN "physiotherapistIds"   TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "clinic_prosthetics"."prosthetics_cases" ADD COLUMN "supervisingDoctorIds" TEXT[] NOT NULL DEFAULT '{}';
