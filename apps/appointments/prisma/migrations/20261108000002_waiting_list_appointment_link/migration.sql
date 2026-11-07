-- ربط قائمة الانتظار بالمواعيد + حقول إضافية جديدة فقط، صفر حذف أو لمس لبيانات موجودة

-- رقم تواصل للمواعيد غير المسجّلة (بدون patientId)
ALTER TABLE "clinic_appointments"."appointments" ADD COLUMN IF NOT EXISTS "contactNumber" TEXT;

-- محسوبة ومخزَّنة وقت إنشاء الموعد فقط — null تلقائياً لكل المواعيد القديمة (العمود جديد بالكامل)
ALTER TABLE "clinic_appointments"."appointments" ADD COLUMN IF NOT EXISTS "createdBySupervisor" BOOLEAN;

-- قائمة الانتظار: نوع الخدمة الجديد (appointmentType) جنب serviceType القديم، والربط بموعد
ALTER TABLE "clinic_appointments"."waiting_list_entries" ADD COLUMN IF NOT EXISTS "appointmentType" "clinic_appointments"."AppointmentType";
ALTER TABLE "clinic_appointments"."waiting_list_entries" ADD COLUMN IF NOT EXISTS "appointmentId" TEXT;
ALTER TABLE "clinic_appointments"."waiting_list_entries" ALTER COLUMN "serviceType" DROP NOT NULL;

ALTER TABLE "clinic_appointments"."waiting_list_entries"
  ADD CONSTRAINT "waiting_list_entries_appointmentId_key" UNIQUE ("appointmentId");

ALTER TABLE "clinic_appointments"."waiting_list_entries"
  ADD CONSTRAINT "waiting_list_entries_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "clinic_appointments"."appointments"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
