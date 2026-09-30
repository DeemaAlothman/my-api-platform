-- إضافة خيار "لا يوجد" لأنواع الألم (painTypes) بنموذج التقييم
ALTER TYPE "clinic_prosthetics"."PainType" ADD VALUE IF NOT EXISTS 'NONE';
