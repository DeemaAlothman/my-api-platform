-- تأكيد المدير التنفيذي على موعد اجتماع تقييم فترة التجربة — إضافي بحت، آمن
ALTER TABLE "evaluation"."ProbationEvaluation" ADD COLUMN IF NOT EXISTS "meetingConfirmedByCeo" BOOLEAN NOT NULL DEFAULT false;
