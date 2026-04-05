-- Add Notifications system to users schema

SET search_path TO users;

CREATE TYPE "NotificationType" AS ENUM (
  'LEAVE_REQUEST_SUBMITTED',
  'LEAVE_REQUEST_APPROVED',
  'LEAVE_REQUEST_REJECTED',
  'LEAVE_REQUEST_CANCELLED',
  'ATTENDANCE_ALERT',
  'ATTENDANCE_JUSTIFICATION',
  'EVALUATION_ASSIGNED',
  'EVALUATION_SUBMITTED',
  'PROBATION_REMINDER',
  'ONBOARDING_TASK',
  'OFFBOARDING_TASK',
  'DOCUMENT_EXPIRY',
  'GENERAL'
);

CREATE TABLE notifications (
  id          TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"    TEXT        NOT NULL,
  type        "NotificationType" NOT NULL,
  "titleAr"   TEXT        NOT NULL,
  "titleEn"   TEXT        NOT NULL,
  "messageAr" TEXT        NOT NULL,
  "messageEn" TEXT        NOT NULL,
  "isRead"    BOOLEAN     NOT NULL DEFAULT false,
  data        JSONB,
  "readAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),

  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_fk FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_notifications_user_id      ON notifications ("userId");
CREATE INDEX idx_notifications_user_is_read ON notifications ("userId", "isRead");
CREATE INDEX idx_notifications_created_at   ON notifications ("createdAt");
