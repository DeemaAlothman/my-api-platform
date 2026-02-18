import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Users Service database...');

  // 1. Create Permissions
  const permissions = [
    // Users
    { name: 'users:read', displayName: 'قراءة المستخدمين', module: 'users' },
    { name: 'users:create', displayName: 'إنشاء مستخدمين', module: 'users' },
    { name: 'users:update', displayName: 'تعديل المستخدمين', module: 'users' },
    { name: 'users:delete', displayName: 'حذف المستخدمين', module: 'users' },
    { name: 'users:assign_roles', displayName: 'تعيين أدوار', module: 'users' },

    // Employees
    { name: 'employees:read', displayName: 'قراءة الموظفين', module: 'employees' },
    { name: 'employees:create', displayName: 'إنشاء موظفين', module: 'employees' },
    { name: 'employees:update', displayName: 'تعديل الموظفين', module: 'employees' },
    { name: 'employees:delete', displayName: 'حذف الموظفين', module: 'employees' },

    // Departments
    { name: 'departments:read', displayName: 'قراءة الأقسام', module: 'departments' },
    { name: 'departments:create', displayName: 'إنشاء أقسام', module: 'departments' },
    { name: 'departments:update', displayName: 'تعديل الأقسام', module: 'departments' },
    { name: 'departments:delete', displayName: 'حذف الأقسام', module: 'departments' },

    // Roles
    { name: 'roles:read', displayName: 'قراءة الأدوار', module: 'roles' },
    { name: 'roles:create', displayName: 'إنشاء أدوار', module: 'roles' },
    { name: 'roles:update', displayName: 'تعديل الأدوار', module: 'roles' },
    { name: 'roles:delete', displayName: 'حذف الأدوار', module: 'roles' },

    // Leave Types
    { name: 'leave_types:read', displayName: 'عرض أنواع الإجازات', module: 'leaves' },
    { name: 'leave_types:create', displayName: 'إنشاء نوع إجازة', module: 'leaves' },
    { name: 'leave_types:update', displayName: 'تعديل نوع إجازة', module: 'leaves' },
    { name: 'leave_types:delete', displayName: 'حذف نوع إجازة', module: 'leaves' },

    // Leave Requests
    { name: 'leave_requests:read', displayName: 'عرض طلبات الإجازة', module: 'leaves' },
    { name: 'leave_requests:read_all', displayName: 'عرض جميع الطلبات', module: 'leaves' },
    { name: 'leave_requests:create', displayName: 'إنشاء طلب إجازة', module: 'leaves' },
    { name: 'leave_requests:update', displayName: 'تعديل طلب إجازة', module: 'leaves' },
    { name: 'leave_requests:submit', displayName: 'تقديم طلب إجازة', module: 'leaves' },
    { name: 'leave_requests:delete', displayName: 'حذف طلب إجازة', module: 'leaves' },
    { name: 'leave_requests:approve_manager', displayName: 'موافقة المدير', module: 'leaves' },
    { name: 'leave_requests:approve_hr', displayName: 'موافقة HR', module: 'leaves' },
    { name: 'leave_requests:cancel', displayName: 'إلغاء طلب إجازة', module: 'leaves' },

    // Leave Balances
    { name: 'leave_balances:read', displayName: 'عرض رصيد الإجازات', module: 'leaves' },
    { name: 'leave_balances:read_all', displayName: 'عرض جميع الأرصدة', module: 'leaves' },
    { name: 'leave_balances:create', displayName: 'إنشاء رصيد', module: 'leaves' },
    { name: 'leave_balances:adjust', displayName: 'تعديل رصيد', module: 'leaves' },
    { name: 'leave_balances:initialize', displayName: 'تهيئة أرصدة', module: 'leaves' },
    { name: 'leave_balances:delete', displayName: 'حذف رصيد', module: 'leaves' },
    { name: 'leave_balances:carry_over', displayName: 'ترحيل الأرصدة', module: 'leaves' },

    // Holidays
    { name: 'holidays:read', displayName: 'عرض العطل الرسمية', module: 'leaves' },
    { name: 'holidays:create', displayName: 'إنشاء عطلة', module: 'leaves' },
    { name: 'holidays:update', displayName: 'تعديل عطلة', module: 'leaves' },
    { name: 'holidays:delete', displayName: 'حذف عطلة', module: 'leaves' },

    // Work Schedules
    { name: 'attendance.work-schedules.read', displayName: 'عرض جداول العمل', module: 'attendance' },
    { name: 'attendance.work-schedules.create', displayName: 'إنشاء جدول عمل', module: 'attendance' },
    { name: 'attendance.work-schedules.update', displayName: 'تعديل جدول عمل', module: 'attendance' },
    { name: 'attendance.work-schedules.delete', displayName: 'حذف جدول عمل', module: 'attendance' },

    // Attendance Records
    { name: 'attendance.records.read', displayName: 'عرض سجلات الحضور', module: 'attendance' },
    { name: 'attendance.records.read-own', displayName: 'عرض حضوري الخاص', module: 'attendance' },
    { name: 'attendance.records.create', displayName: 'إنشاء سجل حضور', module: 'attendance' },
    { name: 'attendance.records.update', displayName: 'تعديل سجل حضور', module: 'attendance' },
    { name: 'attendance.records.delete', displayName: 'حذف سجل حضور', module: 'attendance' },
    { name: 'attendance.records.check-in', displayName: 'تسجيل حضور', module: 'attendance' },
    { name: 'attendance.records.check-out', displayName: 'تسجيل انصراف', module: 'attendance' },

    // Attendance Alerts
    { name: 'attendance.alerts.read', displayName: 'عرض تنبيهات الحضور', module: 'attendance' },
    { name: 'attendance.alerts.read-own', displayName: 'عرض تنبيهاتي الخاصة', module: 'attendance' },
    { name: 'attendance.alerts.create', displayName: 'إنشاء تنبيه حضور', module: 'attendance' },
    { name: 'attendance.alerts.update', displayName: 'تعديل تنبيه حضور', module: 'attendance' },
    { name: 'attendance.alerts.delete', displayName: 'حذف تنبيه حضور', module: 'attendance' },
    { name: 'attendance.alerts.resolve', displayName: 'حل تنبيه حضور', module: 'attendance' },

    // Employee Schedules
    { name: 'attendance.employee-schedules.read', displayName: 'عرض جداول الموظفين', module: 'attendance' },
    { name: 'attendance.employee-schedules.create', displayName: 'إنشاء جدول موظف', module: 'attendance' },
    { name: 'attendance.employee-schedules.update', displayName: 'تعديل جدول موظف', module: 'attendance' },
    { name: 'attendance.employee-schedules.delete', displayName: 'حذف جدول موظف', module: 'attendance' },

    // Attendance Justifications
    { name: 'attendance.justifications.read', displayName: 'عرض تبريرات الحضور', module: 'attendance' },
    { name: 'attendance.justifications.read-own', displayName: 'عرض تبريراتي الخاصة', module: 'attendance' },
    { name: 'attendance.justifications.create-own', displayName: 'تقديم تبرير حضور', module: 'attendance' },
    { name: 'attendance.justifications.manager-review', displayName: 'مراجعة المدير للتبريرات', module: 'attendance' },
    { name: 'attendance.justifications.hr-review', displayName: 'مراجعة HR للتبريرات', module: 'attendance' },

    // Evaluation - Periods
    { name: 'evaluation:periods:read', displayName: 'عرض دورات التقييم', module: 'evaluation' },
    { name: 'evaluation:periods:create', displayName: 'إنشاء دورة تقييم', module: 'evaluation' },
    { name: 'evaluation:periods:update', displayName: 'تعديل دورة تقييم', module: 'evaluation' },
    { name: 'evaluation:periods:delete', displayName: 'حذف دورة تقييم', module: 'evaluation' },
    { name: 'evaluation:periods:manage', displayName: 'إدارة دورات التقييم', module: 'evaluation' },

    // Evaluation - Criteria
    { name: 'evaluation:criteria:read', displayName: 'عرض معايير التقييم', module: 'evaluation' },
    { name: 'evaluation:criteria:create', displayName: 'إنشاء معيار تقييم', module: 'evaluation' },
    { name: 'evaluation:criteria:update', displayName: 'تعديل معيار تقييم', module: 'evaluation' },
    { name: 'evaluation:criteria:delete', displayName: 'حذف معيار تقييم', module: 'evaluation' },

    // Evaluation - Forms
    { name: 'evaluation:forms:view-own', displayName: 'عرض تقييمي الخاص', module: 'evaluation' },
    { name: 'evaluation:forms:view-all', displayName: 'عرض جميع التقييمات', module: 'evaluation' },
    { name: 'evaluation:forms:self-evaluate', displayName: 'التقييم الذاتي', module: 'evaluation' },
    { name: 'evaluation:forms:manager-evaluate', displayName: 'تقييم المرؤوسين', module: 'evaluation' },
    { name: 'evaluation:forms:hr-review', displayName: 'مراجعة HR', module: 'evaluation' },
    { name: 'evaluation:forms:gm-approval', displayName: 'موافقة المدير العام', module: 'evaluation' },

    // Evaluation - Peer & Goals
    { name: 'evaluation:peer:submit', displayName: 'تقديم تقييم الأقران', module: 'evaluation' },
    { name: 'evaluation:goals:manage', displayName: 'إدارة الأهداف', module: 'evaluation' },
  ];

  console.log('Creating permissions...');
  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: perm,
      create: perm,
    });
  }
  console.log(`✅ Created ${permissions.length} permissions`);

  // 2. Create Super Admin Role
  const allPermissions = await prisma.permission.findMany();

  const superAdminRole = await prisma.role.upsert({
    where: { name: 'super_admin' },
    update: {
      displayNameAr: 'مدير النظام',
      displayNameEn: 'Super Admin',
      description: 'Full system access',
    },
    create: {
      name: 'super_admin',
      displayNameAr: 'مدير النظام',
      displayNameEn: 'Super Admin',
      description: 'Full system access',
    },
  });
  console.log('✅ Created Super Admin role');

  // Assign all permissions to Super Admin
  await prisma.rolePermission.deleteMany({
    where: { roleId: superAdminRole.id },
  });

  await prisma.rolePermission.createMany({
    data: allPermissions.map((perm) => ({
      roleId: superAdminRole.id,
      permissionId: perm.id,
    })),
    skipDuplicates: true,
  });
  console.log(`✅ Assigned ${allPermissions.length} permissions to Super Admin`);

  // 3. Create HR Manager Role
  const hrPermissions = allPermissions.filter((p) =>
    ['employees', 'departments'].includes(p.module),
  );

  const hrRole = await prisma.role.upsert({
    where: { name: 'hr_manager' },
    update: {
      displayNameAr: 'مدير الموارد البشرية',
      displayNameEn: 'HR Manager',
      description: 'HR department manager',
    },
    create: {
      name: 'hr_manager',
      displayNameAr: 'مدير الموارد البشرية',
      displayNameEn: 'HR Manager',
      description: 'HR department manager',
    },
  });

  await prisma.rolePermission.deleteMany({
    where: { roleId: hrRole.id },
  });

  await prisma.rolePermission.createMany({
    data: hrPermissions.map((perm) => ({
      roleId: hrRole.id,
      permissionId: perm.id,
    })),
    skipDuplicates: true,
  });
  console.log('✅ Created HR Manager role');

  // 4. Create Admin User
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      email: 'admin@wso.org',
      fullName: 'مدير النظام',
      password: await bcrypt.hash('password123', 10),
      status: 'ACTIVE',
    },
    create: {
      username: 'admin',
      email: 'admin@wso.org',
      fullName: 'مدير النظام',
      password: await bcrypt.hash('password123', 10),
      status: 'ACTIVE',
    },
  });
  console.log('✅ Created admin user');

  // Assign Super Admin role to admin user
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: superAdminRole.id,
    },
  });
  console.log('✅ Assigned Super Admin role to admin user');

  // 5. Create Sample Department
  const itDept = await prisma.department.upsert({
    where: { code: 'IT' },
    update: {
      nameAr: 'قسم تقنية المعلومات',
      nameEn: 'Information Technology',
      nameTr: 'Bilgi Teknolojileri',
    },
    create: {
      code: 'IT',
      nameAr: 'قسم تقنية المعلومات',
      nameEn: 'Information Technology',
      nameTr: 'Bilgi Teknolojileri',
    },
  });
  console.log('✅ Created IT department');

  // 6. Create Sample Job Title
  const devJobTitle = await prisma.jobTitle.upsert({
    where: { code: 'DEV' },
    update: {
      nameAr: 'مطور برمجيات',
      nameEn: 'Software Developer',
      nameTr: 'Yazılım Geliştirici',
    },
    create: {
      code: 'DEV',
      nameAr: 'مطور برمجيات',
      nameEn: 'Software Developer',
      nameTr: 'Yazılım Geliştirici',
    },
  });
  console.log('✅ Created Developer job title');

  // 7. Create Employee record for admin user
  await prisma.employee.upsert({
    where: { userId: adminUser.id },
    update: {
      employeeNumber: 'EMP001',
      firstNameAr: 'مدير',
      lastNameAr: 'النظام',
      firstNameEn: 'System',
      lastNameEn: 'Admin',
      email: 'admin@wso.org',
      nationalId: '1000000001',
      phone: '+966500000001',
      gender: 'MALE',
      hireDate: new Date('2024-01-01'),
      contractType: 'PERMANENT',
      departmentId: itDept.id,
      jobTitleId: devJobTitle.id,
      employmentStatus: 'ACTIVE',
    },
    create: {
      userId: adminUser.id,
      employeeNumber: 'EMP001',
      firstNameAr: 'مدير',
      lastNameAr: 'النظام',
      firstNameEn: 'System',
      lastNameEn: 'Admin',
      email: 'admin@wso.org',
      nationalId: '1000000001',
      phone: '+966500000001',
      gender: 'MALE',
      hireDate: new Date('2024-01-01'),
      contractType: 'PERMANENT',
      departmentId: itDept.id,
      jobTitleId: devJobTitle.id,
      employmentStatus: 'ACTIVE',
    },
  });
  console.log('✅ Created Employee record for admin user');

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
