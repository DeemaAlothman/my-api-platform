-- إضافة مرحلة «رأي الطبيب» (DOCTOR_REVIEW) بعد رأي رئيس القسم — إضافي بحت، آمن
ALTER TYPE "clinic_physio"."PhysioStatus" ADD VALUE IF NOT EXISTS 'DOCTOR_REVIEW';
