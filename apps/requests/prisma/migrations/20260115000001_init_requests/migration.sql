-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "requests";

SET search_path TO requests;

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('TRANSFER', 'RESIGNATION', 'REWARD', 'OTHER', 'PENALTY_PROPOSAL', 'OVERTIME_EMPLOYEE', 'OVERTIME_MANAGER', 'BUSINESS_MISSION', 'DELEGATION', 'HIRING_REQUEST', 'COMPLAINT');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'IN_APPROVAL', 'PENDING_MANAGER', 'PENDING_HR', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApproverRole" AS ENUM ('DIRECT_MANAGER', 'DEPARTMENT_MANAGER', 'TARGET_MANAGER', 'HR', 'CEO', 'CFO');

-- CreateTable
CREATE TABLE requests (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "RequestType" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "notes" TEXT,
    "attachmentUrl" TEXT,
    "details" JSONB,
    "currentStepOrder" INTEGER,
    "targetEmployeeId" TEXT,
    "managerStatus" "ApprovalStatus",
    "managerReviewedBy" TEXT,
    "managerReviewedAt" TIMESTAMP(3),
    "managerNotes" TEXT,
    "hrStatus" "ApprovalStatus",
    "hrReviewedBy" TEXT,
    "hrReviewedAt" TIMESTAMP(3),
    "hrNotes" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE approval_workflows (
    "id" TEXT NOT NULL,
    "requestType" "RequestType" NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "approverRole" "ApproverRole" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_workflows_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "approval_workflows_requestType_stepOrder_key" UNIQUE ("requestType", "stepOrder")
);

-- CreateTable
CREATE TABLE approval_steps (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "approverRole" "ApproverRole" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "approval_steps_requestId_stepOrder_key" UNIQUE ("requestId", "stepOrder")
);

-- CreateTable
CREATE TABLE request_history (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "requests_requestNumber_key" ON requests("requestNumber");
CREATE INDEX "requests_employeeId_idx" ON requests("employeeId");
CREATE INDEX "requests_type_idx" ON requests("type");
CREATE INDEX "requests_status_idx" ON requests("status");
CREATE INDEX "approval_steps_requestId_idx" ON approval_steps("requestId");
CREATE INDEX "request_history_requestId_idx" ON request_history("requestId");

-- AddForeignKey
ALTER TABLE approval_steps ADD CONSTRAINT "approval_steps_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES requests("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE request_history ADD CONSTRAINT "request_history_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES requests("id") ON DELETE CASCADE ON UPDATE CASCADE;
