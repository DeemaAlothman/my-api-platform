-- Migration: permission_audit_log + permission_groups
-- Safe to run multiple times (IF NOT EXISTS)
-- ⚠️ Run on server: psql -h ... -c "$(cat this_file.sql)"

-- ─── Permission Audit Log ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users.permission_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        UUID NOT NULL,
  target_user_id  UUID,
  target_role_id  UUID,
  action          VARCHAR(50) NOT NULL,
  before_state    JSONB,
  after_state     JSONB,
  ip_address      VARCHAR(45),
  user_agent      TEXT,
  reason          TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor      ON users.permission_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_target_user ON users.permission_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_target_role ON users.permission_audit_log(target_role_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at  ON users.permission_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action      ON users.permission_audit_log(action);

-- ─── Permission Groups ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users.permission_groups (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(100) UNIQUE NOT NULL,
  display_name_ar   VARCHAR(255) NOT NULL,
  display_name_en   VARCHAR(255),
  description       TEXT,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users.permission_group_items (
  group_id      UUID NOT NULL REFERENCES users.permission_groups(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES users.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, permission_id)
);

-- ─── Seed permission groups ────────────────────────────────────────────────

INSERT INTO users.permission_groups (name, display_name_ar, display_name_en, description)
VALUES
  ('leave_full_access',       'إدارة الإجازات الكاملة',        'Leave Full Access',         'كل صلاحيات نظام الإجازات'),
  ('leave_employee_self',     'الإجازات الشخصية',               'Personal Leave',            'صلاحيات الموظف لإجازاته فقط'),
  ('leave_manager_approval',  'موافقات المدير على الإجازات',    'Manager Leave Approval',    NULL),
  ('attendance_full',         'إدارة الحضور الكاملة',           'Attendance Full',           NULL),
  ('attendance_employee_self','الحضور الشخصي',                  'Personal Attendance',       NULL),
  ('hr_management',           'إدارة الموارد البشرية',           'HR Management',             NULL),
  ('financial_management',    'الإدارة المالية',                 'Financial Management',      NULL),
  ('recruitment',             'التوظيف',                         'Recruitment',               NULL),
  ('audit_readonly',          'تدقيق (قراءة فقط)',              'Audit Read-Only',           NULL)
ON CONFLICT (name) DO NOTHING;
