-- Add optional general notes field to employees (ملاحظات عامة)
ALTER TABLE users.employees ADD COLUMN IF NOT EXISTS "notes" TEXT;
