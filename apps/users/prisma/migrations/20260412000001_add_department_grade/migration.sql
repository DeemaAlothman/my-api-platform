ALTER TABLE users.departments
  ADD COLUMN IF NOT EXISTS "gradeId" TEXT REFERENCES users.job_grades(id) ON DELETE SET NULL;
