CREATE TABLE IF NOT EXISTS attendance."attendance_computation_logs" (
    "id"                 TEXT        NOT NULL,
    "attendanceRecordId" TEXT,
    "employeeId"         TEXT        NOT NULL,
    "date"               DATE        NOT NULL,
    "action"             TEXT        NOT NULL,
    "source"             TEXT        NOT NULL DEFAULT 'SYSTEM',
    "changedFields"      TEXT,
    "performedBy"        TEXT        DEFAULT 'SYSTEM',
    "notes"              TEXT,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_computation_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "attendance_computation_logs_employeeId_idx"
    ON attendance."attendance_computation_logs"("employeeId");

CREATE INDEX IF NOT EXISTS "attendance_computation_logs_date_idx"
    ON attendance."attendance_computation_logs"("date");

CREATE INDEX IF NOT EXISTS "attendance_computation_logs_attendanceRecordId_idx"
    ON attendance."attendance_computation_logs"("attendanceRecordId");
