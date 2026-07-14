-- إضافة حقل الحالة على التسليم التجريبي
ALTER TABLE clinic_prosthetics.prosthetic_delivery_forms
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'TRIAL';

-- جدول التسليم النهائي
CREATE TABLE clinic_prosthetics.final_delivery_forms (
  id                          TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "caseId"                    TEXT        NOT NULL,
  status                      TEXT        NOT NULL DEFAULT 'FINAL',
  "inspectionDate"            TIMESTAMP(3),
  "prosthetistId"             TEXT,
  "physiotherapistId"         TEXT,
  "ceoId"                     TEXT,
  "ceoSignatureUrl"           TEXT,
  "signatureDate"             TIMESTAMP(3),
  "medicalDirectorId"         TEXT,
  "medicalDirectorSignatureUrl" TEXT,
  "medicalDirectorSignedAt"   TIMESTAMP(3),
  "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"                 TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "final_delivery_forms_pkey" PRIMARY KEY (id)
);

ALTER TABLE clinic_prosthetics.final_delivery_forms
  ADD CONSTRAINT "final_delivery_forms_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES clinic_prosthetics.prosthetics_cases(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX "final_delivery_forms_caseId_key" ON clinic_prosthetics.final_delivery_forms ("caseId");

-- جدول قطع التسليم النهائي
CREATE TABLE clinic_prosthetics.final_delivery_items (
  id                TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "formId"          TEXT        NOT NULL,
  "deliveredProduct" TEXT,
  "partCode"        TEXT,
  quantity          INTEGER,
  company           TEXT,
  notes             TEXT,
  "itemAddedDate"   TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "final_delivery_items_pkey" PRIMARY KEY (id)
);

ALTER TABLE clinic_prosthetics.final_delivery_items
  ADD CONSTRAINT "final_delivery_items_formId_fkey"
  FOREIGN KEY ("formId") REFERENCES clinic_prosthetics.final_delivery_forms(id) ON DELETE CASCADE;

CREATE INDEX "final_delivery_items_formId_idx" ON clinic_prosthetics.final_delivery_items ("formId");
