-- CreateTable
CREATE TABLE "clinic_orthotics"."orthotics_attachments" (
    "id" TEXT NOT NULL,
    "receptionId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT NOT NULL,

    CONSTRAINT "orthotics_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orthotics_attachments_receptionId_idx" ON "clinic_orthotics"."orthotics_attachments"("receptionId");

-- AddForeignKey
ALTER TABLE "clinic_orthotics"."orthotics_attachments" ADD CONSTRAINT "orthotics_attachments_receptionId_fkey" FOREIGN KEY ("receptionId") REFERENCES "clinic_orthotics"."orthotics_receptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
