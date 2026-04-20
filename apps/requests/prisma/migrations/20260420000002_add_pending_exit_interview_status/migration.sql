-- Add PENDING_EXIT_INTERVIEW to RequestStatus enum
-- Must run outside transaction (ALTER TYPE ADD VALUE limitation)
ALTER TYPE requests."RequestStatus" ADD VALUE IF NOT EXISTS 'PENDING_EXIT_INTERVIEW';
