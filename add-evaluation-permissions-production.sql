-- Add Evaluation Permissions to Production Server
-- Run this script on the production database

-- 1. Add evaluation permissions
INSERT INTO users.permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  ('eval-perm-001', 'evaluation:periods:read', 'View Evaluation Periods', 'Can view evaluation periods', 'evaluation', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('eval-perm-002', 'evaluation:periods:create', 'Create Evaluation Period', 'Can create new evaluation periods', 'evaluation', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('eval-perm-003', 'evaluation:periods:update', 'Update Evaluation Period', 'Can update evaluation periods', 'evaluation', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('eval-perm-004', 'evaluation:periods:delete', 'Delete Evaluation Period', 'Can delete evaluation periods', 'evaluation', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('eval-perm-005', 'evaluation:periods:manage', 'Manage Evaluation Periods', 'Can manage evaluation periods (activate, close, generate forms)', 'evaluation', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('eval-perm-006', 'evaluation:criteria:read', 'View Evaluation Criteria', 'Can view evaluation criteria', 'evaluation', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('eval-perm-007', 'evaluation:criteria:create', 'Create Evaluation Criteria', 'Can create evaluation criteria', 'evaluation', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('eval-perm-008', 'evaluation:criteria:update', 'Update Evaluation Criteria', 'Can update evaluation criteria', 'evaluation', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('eval-perm-009', 'evaluation:criteria:delete', 'Delete Evaluation Criteria', 'Can delete evaluation criteria', 'evaluation', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('eval-perm-010', 'evaluation:forms:view-own', 'View Own Evaluation', 'Can view own evaluation forms', 'evaluation', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('eval-perm-011', 'evaluation:forms:view-all', 'View All Evaluations', 'Can view all evaluation forms', 'evaluation', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('eval-perm-012', 'evaluation:forms:self-evaluate', 'Self Evaluate', 'Can submit self evaluation', 'evaluation', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('eval-perm-013', 'evaluation:forms:manager-evaluate', 'Manager Evaluate', 'Can submit manager evaluation for team members', 'evaluation', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('eval-perm-014', 'evaluation:forms:hr-review', 'HR Review', 'Can submit HR review for evaluations', 'evaluation', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('eval-perm-015', 'evaluation:forms:gm-approval', 'GM Approval', 'Can approve/reject evaluations as GM', 'evaluation', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('eval-perm-016', 'evaluation:peer:submit', 'Submit Peer Evaluation', 'Can submit peer evaluations', 'evaluation', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('eval-perm-017', 'evaluation:goals:manage', 'Manage Employee Goals', 'Can manage employee goals', 'evaluation', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- 2. Link all evaluation permissions to super_admin role
INSERT INTO users.role_permissions ("roleId", "permissionId", "assignedAt")
SELECT r.id, p.id, CURRENT_TIMESTAMP
FROM users.roles r, users.permissions p
WHERE r.name = 'super_admin'
  AND p.name LIKE 'evaluation:%'
  AND NOT EXISTS (
    SELECT 1 FROM users.role_permissions rp
    WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
  );

-- 3. Verify permissions were added
SELECT COUNT(*) as evaluation_permissions_count
FROM users.permissions
WHERE name LIKE 'evaluation:%';

-- 4. Verify permissions are linked to super_admin
SELECT COUNT(*) as super_admin_eval_permissions_count
FROM users.role_permissions rp
JOIN users.permissions p ON rp."permissionId" = p.id
JOIN users.roles r ON rp."roleId" = r.id
WHERE r.name = 'super_admin'
  AND p.name LIKE 'evaluation:%';
