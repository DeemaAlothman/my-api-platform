-- حقل الشركة (VITAXIR / VITASYR) على الموظف — إضافي بحت، آمن
ALTER TABLE users.employees ADD COLUMN IF NOT EXISTS "company" TEXT;
