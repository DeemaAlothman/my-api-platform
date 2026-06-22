-- حقل انتهاء فترة العمل عن بعد — لإعادة الربط بالراتب تلقائياً بعد انتهاء الفترة
ALTER TABLE attendance.employee_attendance_configs
  ADD COLUMN IF NOT EXISTS "remoteWorkUntil" DATE;
