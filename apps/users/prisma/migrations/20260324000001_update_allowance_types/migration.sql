-- Update AllowanceType enum: rename MEDICAL→FOOD, EXPERIENCE→PREVIOUS_EXPERIENCE, HIGHER_DEGREE→ACADEMIC_DEGREE

SET search_path TO users;

CREATE TYPE "AllowanceType_new" AS ENUM (
  'FOOD',
  'PREVIOUS_EXPERIENCE',
  'ACADEMIC_DEGREE',
  'WORK_NATURE',
  'RESPONSIBILITY'
);

ALTER TABLE employee_allowances
  ALTER COLUMN type TYPE "AllowanceType_new"
  USING CASE type::text
    WHEN 'MEDICAL'       THEN 'FOOD'
    WHEN 'EXPERIENCE'    THEN 'PREVIOUS_EXPERIENCE'
    WHEN 'HIGHER_DEGREE' THEN 'ACADEMIC_DEGREE'
    ELSE type::text
  END::"AllowanceType_new";

DROP TYPE "AllowanceType";
ALTER TYPE "AllowanceType_new" RENAME TO "AllowanceType";
