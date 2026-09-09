ALTER TABLE "attendance"."employee_attendance_configs" ADD COLUMN "rejectedJustificationsCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "attendance"."employee_attendance_configs" ADD COLUMN "rejectionAlertSentAt" TIMESTAMP(3);
