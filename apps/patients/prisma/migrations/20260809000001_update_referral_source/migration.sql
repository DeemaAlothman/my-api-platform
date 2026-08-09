-- إضافة القيم الجديدة للـ enum
ALTER TYPE clinic_patients."ReferralSource" ADD VALUE IF NOT EXISTS 'DOCTOR';
ALTER TYPE clinic_patients."ReferralSource" ADD VALUE IF NOT EXISTS 'HOSPITAL';
ALTER TYPE clinic_patients."ReferralSource" ADD VALUE IF NOT EXISTS 'ASSOCIATION';
ALTER TYPE clinic_patients."ReferralSource" ADD VALUE IF NOT EXISTS 'FRIEND';
ALTER TYPE clinic_patients."ReferralSource" ADD VALUE IF NOT EXISTS 'STAFF';

-- إضافة حقل referralStaffId
ALTER TABLE clinic_patients.patients
  ADD COLUMN IF NOT EXISTS "referralStaffId" TEXT;
