-- Add BreakType enum and type column to attendance_breaks
DO $$ BEGIN
  CREATE TYPE attendance."BreakType" AS ENUM ('PRAYER', 'MEAL', 'PERSONAL', 'WORK_RELATED', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE attendance.attendance_breaks
  ADD COLUMN IF NOT EXISTS type attendance."BreakType" NOT NULL DEFAULT 'OTHER';
