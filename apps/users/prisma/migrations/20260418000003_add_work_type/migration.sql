-- Create WorkType enum and add workType column to employees
CREATE TYPE users."WorkType" AS ENUM ('FULL_TIME', 'PART_TIME', 'REMOTE');

ALTER TABLE users.employees
  ADD COLUMN IF NOT EXISTS "workType" users."WorkType";
