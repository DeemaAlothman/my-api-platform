-- 1. Add order to job_grades
ALTER TABLE users.job_grades ADD COLUMN IF NOT EXISTS "order" INTEGER;

-- 2. Add hasDrivingLicense to employees
ALTER TABLE users.employees ADD COLUMN IF NOT EXISTS "hasDrivingLicense" BOOLEAN;

-- 3. Add RESIDENCE to AllowanceType enum
ALTER TYPE users."AllowanceType" ADD VALUE IF NOT EXISTS 'RESIDENCE';
