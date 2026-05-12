-- Add isUnlimited flag to leave_types
ALTER TABLE leaves.leave_types ADD COLUMN IF NOT EXISTS "isUnlimited" BOOLEAN NOT NULL DEFAULT false;
