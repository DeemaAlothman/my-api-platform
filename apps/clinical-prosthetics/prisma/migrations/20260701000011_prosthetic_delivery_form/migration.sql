CREATE TABLE clinic_prosthetics.prosthetic_delivery_forms (
  "id"                TEXT         NOT NULL,
  "caseId"            TEXT         NOT NULL,
  "inspectionDate"    TIMESTAMP(3),
  "prosthetistId"     TEXT,
  "physiotherapistId" TEXT,
  "ceoId"             TEXT,
  "ceoSignatureUrl"   TEXT,
  "signatureDate"     TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prosthetic_delivery_forms_pkey"   PRIMARY KEY ("id"),
  CONSTRAINT "prosthetic_delivery_forms_caseId_key" UNIQUE ("caseId"),
  CONSTRAINT "prosthetic_delivery_forms_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES clinic_prosthetics.prosthetics_cases("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE clinic_prosthetics.prosthetic_delivery_items (
  "id"               TEXT         NOT NULL,
  "formId"           TEXT         NOT NULL,
  "deliveredProduct" TEXT,
  "partCode"         TEXT,
  "quantity"         INTEGER,
  "company"          TEXT,
  "notes"            TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prosthetic_delivery_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "prosthetic_delivery_items_formId_fkey"
    FOREIGN KEY ("formId") REFERENCES clinic_prosthetics.prosthetic_delivery_forms("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "prosthetic_delivery_items_formId_idx" ON clinic_prosthetics.prosthetic_delivery_items("formId");
