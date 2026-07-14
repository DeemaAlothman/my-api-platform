-- اعتماد المكونات وربطها بالتسليم تلقائياً
ALTER TABLE clinic_prosthetics.prosthesis_components
  ADD COLUMN IF NOT EXISTS "isApproved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "approvedAt"  TIMESTAMP(3);
