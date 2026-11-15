-- CreateTable
CREATE TABLE "attendance"."work_schedule_time_history" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "workStartTime" TEXT,
    "workEndTime" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),

    CONSTRAINT "work_schedule_time_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_schedule_time_history_scheduleId_idx" ON "attendance"."work_schedule_time_history"("scheduleId");

-- CreateIndex
CREATE INDEX "work_schedule_time_history_scheduleId_effectiveFrom_idx" ON "attendance"."work_schedule_time_history"("scheduleId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "attendance"."work_schedule_time_history" ADD CONSTRAINT "work_schedule_time_history_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "attendance"."work_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed one historical row per existing schedule from its current live time values,
-- effective from the distant past, so no existing record's computed result changes
-- the moment this migration is applied.
INSERT INTO "attendance"."work_schedule_time_history" ("id", "scheduleId", "workStartTime", "workEndTime", "effectiveFrom", "effectiveTo")
SELECT gen_random_uuid(), "id", "workStartTime", "workEndTime", '2000-01-01 00:00:00'::timestamp, NULL
FROM "attendance"."work_schedules";
