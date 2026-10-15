-- CreateTable
CREATE TABLE "clinic_appointments"."potential_client_attachments" (
    "id" TEXT NOT NULL,
    "potentialClientId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT NOT NULL,

    CONSTRAINT "potential_client_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "potential_client_attachments_potentialClientId_idx" ON "clinic_appointments"."potential_client_attachments"("potentialClientId");

-- AddForeignKey
ALTER TABLE "clinic_appointments"."potential_client_attachments" ADD CONSTRAINT "potential_client_attachments_potentialClientId_fkey" FOREIGN KEY ("potentialClientId") REFERENCES "clinic_appointments"."potential_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
