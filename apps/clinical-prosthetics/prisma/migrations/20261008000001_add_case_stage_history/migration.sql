-- تاريخ مراحل الحالة: جدول جديد فقط، لا يلمس أي جدول أو سجل موجود
CREATE TABLE "clinic_prosthetics"."case_stage_history" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "reason" TEXT,
    "changedBy" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "case_stage_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "case_stage_history_caseId_changedAt_idx" ON "clinic_prosthetics"."case_stage_history"("caseId", "changedAt");
