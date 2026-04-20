-- Add WORK_ACCIDENT and REMOTE_WORK to RequestType enum
-- Must run outside transaction (ALTER TYPE ADD VALUE limitation)
ALTER TYPE requests."RequestType" ADD VALUE IF NOT EXISTS 'WORK_ACCIDENT';
ALTER TYPE requests."RequestType" ADD VALUE IF NOT EXISTS 'REMOTE_WORK';
