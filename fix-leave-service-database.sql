-- Fix Leave Service Database Schema and Tables
-- Run this on production server to create leaves schema and tables

-- 1. Create leaves schema if not exists
CREATE SCHEMA IF NOT EXISTS leaves;

-- 2. Drop existing tables if any (to avoid conflicts)
DROP TABLE IF EXISTS leaves.leave_request_history CASCADE;
DROP TABLE IF EXISTS leaves.leave_requests CASCADE;
DROP TABLE IF EXISTS leaves.leave_balances CASCADE;
DROP TABLE IF EXISTS leaves.holidays CASCADE;
DROP TABLE IF EXISTS leaves.leave_types CASCADE;

-- 3. Create leave_types table
CREATE TABLE leaves.leave_types (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "defaultDays" INTEGER NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "requiresAttachment" BOOLEAN NOT NULL DEFAULT false,
    "maxDaysPerRequest" INTEGER,
    "minDaysNotice" INTEGER,
    "allowHalfDay" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- 4. Create leave_balances table
CREATE TABLE leaves.leave_balances (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "totalDays" DOUBLE PRECISION NOT NULL,
    "usedDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendingDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carriedOverDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adjustmentDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adjustmentReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- 5. Create leave_requests table
CREATE TABLE leaves.leave_requests (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalDays" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "isHalfDay" BOOLEAN NOT NULL DEFAULT false,
    "halfDayPeriod" TEXT,
    "substituteId" TEXT,
    "contactDuring" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "managerStatus" TEXT,
    "managerApprovedBy" TEXT,
    "managerApprovedAt" TIMESTAMP(3),
    "managerNotes" TEXT,
    "hrStatus" TEXT,
    "hrApprovedBy" TEXT,
    "hrApprovedAt" TIMESTAMP(3),
    "hrNotes" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- 6. Create leave_request_history table
CREATE TABLE leaves.leave_request_history (
    "id" TEXT NOT NULL,
    "leaveRequestId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_request_history_pkey" PRIMARY KEY ("id")
);

-- 7. Create holidays table
CREATE TABLE leaves.holidays (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "type" TEXT NOT NULL DEFAULT 'PUBLIC',
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- 8. Create indexes
CREATE UNIQUE INDEX "leave_types_code_key" ON leaves.leave_types("code");
CREATE UNIQUE INDEX "leave_balances_employeeId_leaveTypeId_year_key" ON leaves.leave_balances("employeeId", "leaveTypeId", "year");

-- 9. Add foreign keys
ALTER TABLE leaves.leave_balances ADD CONSTRAINT "leave_balances_leaveTypeId_fkey"
    FOREIGN KEY ("leaveTypeId") REFERENCES leaves.leave_types("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE leaves.leave_requests ADD CONSTRAINT "leave_requests_leaveTypeId_fkey"
    FOREIGN KEY ("leaveTypeId") REFERENCES leaves.leave_types("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE leaves.leave_request_history ADD CONSTRAINT "leave_request_history_leaveRequestId_fkey"
    FOREIGN KEY ("leaveRequestId") REFERENCES leaves.leave_requests("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 10. Insert default leave types
INSERT INTO leaves.leave_types (id, code, "nameAr", "nameEn", "defaultDays", "isPaid", "requiresApproval", "requiresAttachment", "maxDaysPerRequest", "minDaysNotice", "allowHalfDay", color, "isActive")
VALUES
    ('leave-type-001', 'ANNUAL', 'إجازة سنوية', 'Annual Leave', 21, true, true, false, NULL, 3, true, '#4CAF50', true),
    ('leave-type-002', 'SICK', 'إجازة مرضية', 'Sick Leave', 14, true, false, true, 7, 0, true, '#F44336', true),
    ('leave-type-003', 'EMERGENCY', 'إجازة طارئة', 'Emergency Leave', 5, true, true, false, 3, 0, true, '#FF9800', true),
    ('leave-type-004', 'UNPAID', 'إجازة بدون راتب', 'Unpaid Leave', 0, false, true, false, NULL, 7, false, '#9E9E9E', true),
    ('leave-type-005', 'MATERNITY', 'إجازة أمومة', 'Maternity Leave', 90, true, true, true, NULL, 30, false, '#E91E63', true),
    ('leave-type-006', 'PATERNITY', 'إجازة أبوة', 'Paternity Leave', 3, true, true, true, NULL, 7, false, '#2196F3', true)
ON CONFLICT (id) DO NOTHING;

-- 11. Verify tables were created
SELECT
    'leaves schema tables:' as info,
    COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'leaves';

-- 12. List all tables in leaves schema
SELECT
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'leaves'
ORDER BY table_name;
