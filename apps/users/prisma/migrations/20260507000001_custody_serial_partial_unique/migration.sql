-- Migration: custody serial number partial unique index
-- Replace global unique constraint with partial unique index
-- Only enforce uniqueness for active custodies (status = 'WITH_EMPLOYEE')
-- Returned/damaged/lost custodies may share serial numbers

-- Step 1: Drop the global unique constraint
ALTER TABLE users.custodies DROP CONSTRAINT IF EXISTS "custodies_serialNumber_key";

-- Step 2: Create partial unique index (active custodies only)
CREATE UNIQUE INDEX IF NOT EXISTS custodies_serial_number_active_unique
  ON users.custodies ("serialNumber")
  WHERE status = 'WITH_EMPLOYEE'
    AND "serialNumber" IS NOT NULL;
