ALTER TABLE clinic_prosthetics.prosthetics_cases
  ALTER COLUMN "amputationLevel" TYPE "clinic_prosthetics"."AmputationLevel"[]
  USING CASE
    WHEN "amputationLevel" IS NULL THEN ARRAY[]::"clinic_prosthetics"."AmputationLevel"[]
    ELSE ARRAY["amputationLevel"]::"clinic_prosthetics"."AmputationLevel"[]
  END;

ALTER TABLE clinic_prosthetics.prosthetics_cases
  ALTER COLUMN "amputationLevel" SET DEFAULT ARRAY[]::"clinic_prosthetics"."AmputationLevel"[];
