-- توقيع المدير الطبي على نموذج التسليم
ALTER TABLE clinic_prosthetics.prosthetic_delivery_forms
  ADD COLUMN IF NOT EXISTS "medicalDirectorId"           TEXT,
  ADD COLUMN IF NOT EXISTS "medicalDirectorSignatureUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "medicalDirectorSignedAt"     TIMESTAMP(3);

-- تاريخ إضافة القطعة على عناصر التسليم
ALTER TABLE clinic_prosthetics.prosthetic_delivery_items
  ADD COLUMN IF NOT EXISTS "itemAddedDate" TIMESTAMP(3);
