-- إضافة نوع إشعار للبديل في الإجازات
ALTER TYPE users."NotificationType" ADD VALUE IF NOT EXISTS 'LEAVE_REQUEST_SUBSTITUTE';
