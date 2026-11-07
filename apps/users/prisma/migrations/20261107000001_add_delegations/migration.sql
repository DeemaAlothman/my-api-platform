-- تفويض مؤقت للصلاحيات/المسمى الوظيفي أثناء إجازة — جدول جديد بالكامل، بلا أي تعديل على جداول موجودة
CREATE TABLE "delegations" (
    "id" TEXT NOT NULL,
    "delegatorId" TEXT NOT NULL,
    "delegateId" TEXT NOT NULL,
    "leaveRequestId" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delegations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "delegations_delegatorId_idx" ON "delegations"("delegatorId");
CREATE INDEX "delegations_delegateId_idx" ON "delegations"("delegateId");
CREATE INDEX "delegations_leaveRequestId_idx" ON "delegations"("leaveRequestId");
