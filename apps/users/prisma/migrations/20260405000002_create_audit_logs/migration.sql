-- Create audit_logs table in public schema (shared across all services)

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           BIGSERIAL PRIMARY KEY,
  "userId"     TEXT,
  username     TEXT,
  action       TEXT NOT NULL,
  resource     TEXT,
  "resourceId" TEXT,
  method       TEXT NOT NULL,
  path         TEXT NOT NULL,
  ip           TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON public.audit_logs ("userId");
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource   ON public.audit_logs (resource);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs ("createdAt");
