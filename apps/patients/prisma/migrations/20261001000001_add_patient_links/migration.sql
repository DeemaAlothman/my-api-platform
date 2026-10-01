-- جدول جديد بالكامل: روابط خارجية مرتبطة بمريض (نفس مبدأ المستندات، بدون ملف — رابط فقط)
CREATE TABLE "clinic_patients"."patient_links" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedBy" TEXT NOT NULL,

    CONSTRAINT "patient_links_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "patient_links_patientId_idx" ON "clinic_patients"."patient_links"("patientId");

ALTER TABLE "clinic_patients"."patient_links" ADD CONSTRAINT "patient_links_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "clinic_patients"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
