-- إضافة حالة EVALUATION (التقييم) لمسار حالات الفيزياء — إضافي بحت، آمن
ALTER TYPE "clinic_physio"."PhysioStatus" ADD VALUE IF NOT EXISTS 'EVALUATION';
