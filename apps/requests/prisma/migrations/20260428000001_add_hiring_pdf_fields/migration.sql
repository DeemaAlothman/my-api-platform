-- Phase 2: Add hiring PDF fields to requests table

SET search_path TO requests;

ALTER TABLE requests ADD COLUMN IF NOT EXISTS "hiringContractPdfUrl" TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS "hiringCompletedAt"    TIMESTAMP(3);
ALTER TABLE requests ADD COLUMN IF NOT EXISTS "hiringCompletedBy"    TEXT;
