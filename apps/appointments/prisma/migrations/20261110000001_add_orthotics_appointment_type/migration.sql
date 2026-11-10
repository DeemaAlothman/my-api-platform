-- نوع موعد جديد "مقومات" — إضافة قيمة إلى enum قائم فقط.
-- ADD VALUE لا يعدّل ولا يحذف أي قيمة موجودة ولا أي سطر مسجَّل عليها.
ALTER TYPE "clinic_appointments"."AppointmentType" ADD VALUE IF NOT EXISTS 'ORTHOTICS';
