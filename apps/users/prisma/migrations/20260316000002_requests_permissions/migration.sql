-- ============================================================
-- Migration: Add requests service permissions
-- ============================================================
SET search_path TO users;

INSERT INTO permissions (id, name, description, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'requests:approve',          'Approve approval steps in requests',       NOW(), NOW()),
  (gen_random_uuid()::text, 'requests:reject',           'Reject approval steps in requests',        NOW(), NOW()),
  (gen_random_uuid()::text, 'requests:ceo-approve',      'Approve requests as CEO',                  NOW(), NOW()),
  (gen_random_uuid()::text, 'requests:cfo-approve',      'Approve requests as CFO',                  NOW(), NOW()),
  (gen_random_uuid()::text, 'requests:hr-approve',       'Approve requests as HR',                   NOW(), NOW()),
  (gen_random_uuid()::text, 'requests:read-all-steps',   'View all approval steps across requests',  NOW(), NOW()),
  (gen_random_uuid()::text, 'requests:manage-workflows', 'Manage approval workflow configurations',  NOW(), NOW())
ON CONFLICT DO NOTHING;
