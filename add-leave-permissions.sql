-- إضافة صلاحيات Leave Service إلى قاعدة البيانات

-- Leave Types Permissions
INSERT INTO users.permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'leave_types:read', 'عرض أنواع الإجازات', 'View Leave Types', 'leaves', NOW(), NOW()),
  (gen_random_uuid(), 'leave_types:create', 'إنشاء نوع إجازة', 'Create Leave Type', 'leaves', NOW(), NOW()),
  (gen_random_uuid(), 'leave_types:update', 'تعديل نوع إجازة', 'Update Leave Type', 'leaves', NOW(), NOW()),
  (gen_random_uuid(), 'leave_types:delete', 'حذف نوع إجازة', 'Delete Leave Type', 'leaves', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Leave Requests Permissions
INSERT INTO users.permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'leave_requests:read', 'عرض طلبات الإجازة', 'View Leave Requests', 'leaves', NOW(), NOW()),
  (gen_random_uuid(), 'leave_requests:read_all', 'عرض جميع الطلبات', 'View All Requests', 'leaves', NOW(), NOW()),
  (gen_random_uuid(), 'leave_requests:create', 'إنشاء طلب إجازة', 'Create Leave Request', 'leaves', NOW(), NOW()),
  (gen_random_uuid(), 'leave_requests:update', 'تعديل طلب إجازة', 'Update Leave Request', 'leaves', NOW(), NOW()),
  (gen_random_uuid(), 'leave_requests:submit', 'تقديم طلب إجازة', 'Submit Leave Request', 'leaves', NOW(), NOW()),
  (gen_random_uuid(), 'leave_requests:delete', 'حذف طلب إجازة', 'Delete Leave Request', 'leaves', NOW(), NOW()),
  (gen_random_uuid(), 'leave_requests:approve_manager', 'موافقة المدير', 'Manager Approval', 'leaves', NOW(), NOW()),
  (gen_random_uuid(), 'leave_requests:approve_hr', 'موافقة HR', 'HR Approval', 'leaves', NOW(), NOW()),
  (gen_random_uuid(), 'leave_requests:cancel', 'إلغاء طلب إجازة', 'Cancel Leave Request', 'leaves', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Leave Balances Permissions
INSERT INTO users.permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'leave_balances:read', 'عرض رصيد الإجازات', 'View Leave Balance', 'leaves', NOW(), NOW()),
  (gen_random_uuid(), 'leave_balances:read_all', 'عرض جميع الأرصدة', 'View All Balances', 'leaves', NOW(), NOW()),
  (gen_random_uuid(), 'leave_balances:create', 'إنشاء رصيد', 'Create Balance', 'leaves', NOW(), NOW()),
  (gen_random_uuid(), 'leave_balances:adjust', 'تعديل رصيد', 'Adjust Balance', 'leaves', NOW(), NOW()),
  (gen_random_uuid(), 'leave_balances:initialize', 'تهيئة أرصدة', 'Initialize Balances', 'leaves', NOW(), NOW()),
  (gen_random_uuid(), 'leave_balances:delete', 'حذف رصيد', 'Delete Balance', 'leaves', NOW(), NOW()),
  (gen_random_uuid(), 'leave_balances:carry_over', 'ترحيل الأرصدة', 'Carry Over Balances', 'leaves', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Holidays Permissions
INSERT INTO users.permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'holidays:read', 'عرض العطل الرسمية', 'View Holidays', 'leaves', NOW(), NOW()),
  (gen_random_uuid(), 'holidays:create', 'إنشاء عطلة', 'Create Holiday', 'leaves', NOW(), NOW()),
  (gen_random_uuid(), 'holidays:update', 'تعديل عطلة', 'Update Holiday', 'leaves', NOW(), NOW()),
  (gen_random_uuid(), 'holidays:delete', 'حذف عطلة', 'Delete Holiday', 'leaves', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- إضافة جميع صلاحيات Leave للـ Super Admin Role
DO $$
DECLARE
  admin_role_id TEXT;
  perm RECORD;
BEGIN
  -- الحصول على Super Admin Role ID
  SELECT id INTO admin_role_id FROM users.roles WHERE name = 'super_admin' LIMIT 1;

  IF admin_role_id IS NOT NULL THEN
    -- إضافة جميع صلاحيات leaves للـ Super Admin
    FOR perm IN SELECT id FROM users.permissions WHERE module = 'leaves'
    LOOP
      INSERT INTO users.role_permissions ("roleId", "permissionId")
      VALUES (admin_role_id, perm.id)
      ON CONFLICT DO NOTHING;
    END LOOP;

    RAISE NOTICE 'تم إضافة صلاحيات Leave Service للـ Super Admin';
  ELSE
    RAISE NOTICE 'لم يتم العثور على Super Admin Role';
  END IF;
END $$;
