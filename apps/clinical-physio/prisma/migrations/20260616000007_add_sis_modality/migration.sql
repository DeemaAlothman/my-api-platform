-- إضافة نوع علاج SIS (التحفيز الكهرومغناطيسي) لـ TherapyModality — إضافي بحت، آمن
ALTER TYPE "clinic_physio"."TherapyModality" ADD VALUE IF NOT EXISTS 'SIS';
