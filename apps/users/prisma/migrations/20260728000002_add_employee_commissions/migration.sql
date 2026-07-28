-- Add commissions JSONB array to employees (replaces single salesCommission field)
ALTER TABLE users.employees
  ADD COLUMN IF NOT EXISTS commissions JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Migrate existing salesCommission values into the new array
UPDATE users.employees
SET commissions = jsonb_build_array(
  jsonb_build_object('amount', "salesCommission"::text::numeric, 'description', '')
)
WHERE "salesCommission" IS NOT NULL AND "salesCommission" > 0;
