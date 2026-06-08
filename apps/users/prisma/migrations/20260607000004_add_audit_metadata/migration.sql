-- Add optional metadata (sanitized request body) to audit logs for detailed descriptions
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS "metadata" JSONB;
