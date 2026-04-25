SET search_path TO users;

INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'mail:send',      'إرسال بريد داخلي',   'Send internal mail',      'mail', NOW(), NOW()),
  (gen_random_uuid()::text, 'mail:read_own',  'عرض بريدي',          'Read own mailbox',        'mail', NOW(), NOW()),
  (gen_random_uuid()::text, 'mail:read_all',  'عرض جميع الرسائل',   'Read all mailboxes',      'mail', NOW(), NOW()),
  (gen_random_uuid()::text, 'mail:draft',     'إدارة المسودات',     'Create and edit drafts',  'mail', NOW(), NOW()),
  (gen_random_uuid()::text, 'mail:update',    'تحديث الرسائل',      'Update read/star/move',   'mail', NOW(), NOW()),
  (gen_random_uuid()::text, 'mail:delete',    'حذف الرسائل',        'Delete mail messages',    'mail', NOW(), NOW()),
  (gen_random_uuid()::text, 'mail:manage',    'إدارة نظام البريد',  'Mail admin operations',   'mail', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;
