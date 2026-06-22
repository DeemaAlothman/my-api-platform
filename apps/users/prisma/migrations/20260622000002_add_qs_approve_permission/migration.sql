-- صلاحية تقديم طلبات المكافأة/العقوبة لمشرف الجودة (QS)
SET search_path TO users;

INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'requests:qs-approve',
  'مشرف الجودة - طلبات المكافأة والعقوبة',
  'Allows QS supervisor to submit reward/penalty requests',
  'requests',
  NOW(), NOW()
)
ON CONFLICT (name) DO NOTHING;
