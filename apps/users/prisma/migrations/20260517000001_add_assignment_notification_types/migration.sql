-- Add new notification types for additional assignment workflow
ALTER TYPE users."NotificationType" ADD VALUE IF NOT EXISTS 'ADDITIONAL_ASSIGNMENT_REQUEST';
ALTER TYPE users."NotificationType" ADD VALUE IF NOT EXISTS 'ADDITIONAL_ASSIGNMENT_DECISION';
