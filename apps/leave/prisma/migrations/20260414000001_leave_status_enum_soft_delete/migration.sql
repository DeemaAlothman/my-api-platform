-- Migration: LeaveRequest status enum + soft-delete
SET search_path TO leaves;

-- 1. إنشاء enum LeaveRequestStatus
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid
                 WHERE t.typname = 'LeaveRequestStatus' AND n.nspname = 'leaves') THEN
    CREATE TYPE "LeaveRequestStatus" AS ENUM (
      'DRAFT', 'PENDING_MANAGER', 'PENDING_HR', 'APPROVED', 'REJECTED', 'CANCELLED'
    );
  END IF;
END $$;

-- 2. تصحيح القيم غير الصالحة قبل التحويل
--    'PENDING' كان مستخدماً في seed قديم → نحوّله إلى PENDING_MANAGER
UPDATE leave_requests SET status = 'PENDING_MANAGER' WHERE status = 'PENDING';
-- أي قيم غير معروفة أخرى → نحوّلها إلى DRAFT
UPDATE leave_requests
  SET status = 'DRAFT'
  WHERE status NOT IN ('DRAFT','PENDING_MANAGER','PENDING_HR','APPROVED','REJECTED','CANCELLED');

-- تحويل عمود status من TEXT إلى enum
-- يجب حذف الـ default أولاً لأن PostgreSQL لا يحوّله تلقائياً
ALTER TABLE leave_requests ALTER COLUMN status DROP DEFAULT;

ALTER TABLE leave_requests
  ALTER COLUMN status TYPE "LeaveRequestStatus"
  USING status::"LeaveRequestStatus";

ALTER TABLE leave_requests
  ALTER COLUMN status SET DEFAULT 'DRAFT'::"LeaveRequestStatus";

-- 3. إضافة عمود deletedAt للـ soft-delete
ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- 4. index على deletedAt لتسريع الاستعلامات
CREATE INDEX IF NOT EXISTS "leave_requests_deletedAt_idx" ON leave_requests("deletedAt");
