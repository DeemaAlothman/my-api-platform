-- ربط item التسليم بمصدره من المكونات لتجنب التكرار
ALTER TABLE clinic_prosthetics.prosthetic_delivery_items
  ADD COLUMN IF NOT EXISTS "sourceComponentId" TEXT;

CREATE INDEX IF NOT EXISTS "prosthetic_delivery_items_sourceComponentId_idx"
  ON clinic_prosthetics.prosthetic_delivery_items ("sourceComponentId");
