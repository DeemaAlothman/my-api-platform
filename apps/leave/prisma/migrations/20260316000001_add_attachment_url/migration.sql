-- ============================================================
-- Migration: Add attachmentUrl to leave_requests
-- ============================================================
SET search_path TO leaves;

ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT;
