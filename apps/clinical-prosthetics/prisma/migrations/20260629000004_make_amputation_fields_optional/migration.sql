ALTER TABLE clinic_prosthetics.prosthetics_cases
  ALTER COLUMN "amputationDate" DROP NOT NULL,
  ALTER COLUMN "amputationCause" DROP NOT NULL,
  ALTER COLUMN "amputationType" DROP NOT NULL,
  ALTER COLUMN "amputationSide" DROP NOT NULL,
  ALTER COLUMN "amputationLevel" DROP NOT NULL;
