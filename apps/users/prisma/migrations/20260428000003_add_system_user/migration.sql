-- B.5.1: Create System User for automated messages (welcome, birthday, etc.)
-- Password is set to a non-bcrypt string so this account can NEVER be used to login

SET search_path TO users;

INSERT INTO users (id, username, email, "fullName", password, status, "createdAt", "updatedAt")
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'system',
  'system@hr.local',
  'نظام الموارد البشرية',
  '!SYSTEM_ACCOUNT_DISABLED_CANNOT_LOGIN',
  'ACTIVE',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
