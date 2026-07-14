-- اعتماد القطع في التسليم النهائي
ALTER TABLE clinic_prosthetics.prosthetic_delivery_items
  ADD COLUMN IF NOT EXISTS "isApproved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "approvedAt"  TIMESTAMP(3);
