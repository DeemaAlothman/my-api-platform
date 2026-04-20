-- Add WORK_ACCIDENT and REMOTE_WORK to RequestType enum
-- Must run outside transaction (ALTER TYPE ADD VALUE limitation)
ALTER TYPE requests."RequestType" ADD VALUE IF NOT EXISTS 'WORK_ACCIDENT';
ALTER TYPE requests."RequestType" ADD VALUE IF NOT EXISTS 'REMOTE_WORK';

-- Seed approval workflows for new request types
INSERT INTO requests.approval_workflows (id, "requestType", "stepOrder", "approverRole", "isRequired", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'WORK_ACCIDENT', 1, 'DIRECT_MANAGER', true, NOW(), NOW()),
  (gen_random_uuid(), 'WORK_ACCIDENT', 2, 'HR',             true, NOW(), NOW()),
  (gen_random_uuid(), 'REMOTE_WORK',   1, 'DIRECT_MANAGER', true, NOW(), NOW()),
  (gen_random_uuid(), 'REMOTE_WORK',   2, 'HR',             true, NOW(), NOW())
ON CONFLICT DO NOTHING;
