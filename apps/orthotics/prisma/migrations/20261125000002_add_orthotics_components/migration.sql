-- قطع العرض الفني لاستقبال المقومات. جدول جديد بالكامل: لا يُعدَّل ولا يُحذف
-- شيء مما هو قائم.
CREATE TABLE IF NOT EXISTS clinic_orthotics.orthotics_components (
  id                TEXT PRIMARY KEY,
  "receptionId"     TEXT NOT NULL,
  "partCode"        TEXT NOT NULL,
  "partName"        TEXT NOT NULL,
  supplier          TEXT NOT NULL,
  "sourceLocation"  TEXT NOT NULL,
  "warehouseItemId"   TEXT,
  "materialRequestId" TEXT,
  "addedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "addedBy"   TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "orthotics_components_receptionId_fkey"
    FOREIGN KEY ("receptionId")
    REFERENCES clinic_orthotics.orthotics_receptions(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "orthotics_components_receptionId_idx"
  ON clinic_orthotics.orthotics_components("receptionId");
