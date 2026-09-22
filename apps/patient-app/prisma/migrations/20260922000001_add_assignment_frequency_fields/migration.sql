-- حقول رقمية اختيارية للتكرار (يبقى frequencyText نصاً حراً للعرض فقط) — يقدر التطبيق يستخدمها للجدولة/التذكيرات
ALTER TABLE "patient_app"."session_exercise_assignments" ADD COLUMN "timesPerDay" INTEGER;
ALTER TABLE "patient_app"."session_exercise_assignments" ADD COLUMN "daysPerWeek" INTEGER;
