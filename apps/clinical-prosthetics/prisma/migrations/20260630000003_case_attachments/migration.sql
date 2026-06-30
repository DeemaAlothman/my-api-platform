-- إضافة جدول مرفقات الحالة (صور البتر وغيرها) — جدول جديد فقط، لا يلمس أي بيانات موجودة

CREATE TABLE "clinic_prosthetics"."case_attachments" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "caption" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT NOT NULL,

    CONSTRAINT "case_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "case_attachments_caseId_idx" ON "clinic_prosthetics"."case_attachments"("caseId");

ALTER TABLE "clinic_prosthetics"."case_attachments" ADD CONSTRAINT "case_attachments_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "clinic_prosthetics"."prosthetics_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
