import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Attendance Service database...');

  // 1. Create Default Work Schedules
  const workSchedules = [
    {
      code: 'WS001',
      nameAr: 'دوام كامل - موظفين إداريين',
      nameEn: 'Full Time - Admin Staff',
      workStartTime: '09:00',
      workEndTime: '17:00',
      workDays: '[0,1,2,3,4]', // Sunday to Thursday
      lateToleranceMin: 15,
      earlyLeaveToleranceMin: 15,
      allowOvertime: true,
      maxOvertimeHours: 2.0,
      isActive: true,
      description: 'جدول العمل الافتراضي للموظفين الإداريين',
    },
    {
      code: 'WS002',
      nameAr: 'دوام صباحي',
      nameEn: 'Morning Shift',
      workStartTime: '08:00',
      workEndTime: '16:00',
      workDays: '[0,1,2,3,4]',
      lateToleranceMin: 10,
      earlyLeaveToleranceMin: 10,
      allowOvertime: true,
      maxOvertimeHours: 2.0,
      isActive: true,
      description: 'الدوام الصباحي',
    },
    {
      code: 'WS003',
      nameAr: 'دوام مسائي',
      nameEn: 'Evening Shift',
      workStartTime: '14:00',
      workEndTime: '22:00',
      workDays: '[0,1,2,3,4]',
      lateToleranceMin: 10,
      earlyLeaveToleranceMin: 10,
      allowOvertime: true,
      maxOvertimeHours: 2.0,
      isActive: true,
      description: 'الدوام المسائي',
    },
  ];

  console.log('Creating work schedules...');
  for (const schedule of workSchedules) {
    await prisma.workSchedule.upsert({
      where: { code: schedule.code },
      update: schedule,
      create: schedule,
    });
  }
  console.log(`✅ Created ${workSchedules.length} work schedules`);

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
