-- إشعار مندوبي المبيعات لتعبئة استبيان رضا العميل عند بلوغ المريض نقطة معيّنة بمساره العلاجي
ALTER TYPE users."NotificationType" ADD VALUE IF NOT EXISTS 'PATIENT_SURVEY_REQUIRED';
