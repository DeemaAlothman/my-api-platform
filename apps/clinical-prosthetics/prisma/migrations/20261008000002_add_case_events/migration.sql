-- أحداث الحالة للسجل الزمني: جدول جديد فقط، لا يلمس أي جدول أو سجل موجود
CREATE TABLE "clinic_prosthetics"."case_events" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "stage" TEXT,
    "actorId" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "case_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "case_events_caseId_createdAt_idx" ON "clinic_prosthetics"."case_events"("caseId", "createdAt");
