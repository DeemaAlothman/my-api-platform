-- AlterTable
-- يسمح بتمرين عام للمريض غير مرتبط بجلسة محددة (erpSessionId = NULL)
ALTER TABLE "patient_app"."session_exercise_assignments" ALTER COLUMN "erpSessionId" DROP NOT NULL;
