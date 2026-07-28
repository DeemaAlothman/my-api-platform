-- Convert painLevel and painDuration on physio_cases from enum to TEXT
-- Allows any string value from the frontend without validation errors

ALTER TABLE "clinic_physio"."physio_cases"
  ALTER COLUMN "painLevel"    TYPE TEXT USING "painLevel"::TEXT,
  ALTER COLUMN "painDuration" TYPE TEXT USING "painDuration"::TEXT;
