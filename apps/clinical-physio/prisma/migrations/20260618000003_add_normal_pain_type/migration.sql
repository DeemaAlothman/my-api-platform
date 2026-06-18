-- إضافة نوع ألم "عادي" (NORMAL) لـ PhysioPainType — إضافي بحت، آمن
ALTER TYPE "clinic_physio"."PhysioPainType" ADD VALUE IF NOT EXISTS 'NORMAL';
