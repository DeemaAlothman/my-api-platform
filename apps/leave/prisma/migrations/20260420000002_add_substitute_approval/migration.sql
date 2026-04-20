-- Add PENDING_SUBSTITUTE to LeaveRequestStatus enum
ALTER TYPE leaves."LeaveRequestStatus" ADD VALUE IF NOT EXISTS 'PENDING_SUBSTITUTE';

-- Add substitute approval fields to leave_requests
ALTER TABLE leaves.leave_requests
  ADD COLUMN IF NOT EXISTS "substituteStatus"     TEXT,
  ADD COLUMN IF NOT EXISTS "substituteApprovedAt" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "substituteNotes"      TEXT;
