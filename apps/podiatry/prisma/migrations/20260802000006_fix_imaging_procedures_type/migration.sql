-- Change imagingProcedures from TEXT to JSONB array
UPDATE clinic_podiatry.podiatry_receptions
  SET "imagingProcedures" = '[]'
  WHERE "imagingProcedures" IS NULL OR "imagingProcedures" = '';

ALTER TABLE clinic_podiatry.podiatry_receptions
  ALTER COLUMN "imagingProcedures" TYPE JSONB USING "imagingProcedures"::jsonb,
  ALTER COLUMN "imagingProcedures" SET DEFAULT '[]',
  ALTER COLUMN "imagingProcedures" SET NOT NULL;
