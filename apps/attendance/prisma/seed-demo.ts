/**
 * seed-demo.ts — بيانات تجريبية للحضور
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EMP = {
  sarah:  'e0000001-0000-0000-0000-000000000000',
  khalid: 'e0000002-0000-0000-0000-000000000000',
  fatima: 'e0000003-0000-0000-0000-000000000000',
  omar:   'e0000004-0000-0000-0000-000000000000',
  nora:   'e0000005-0000-0000-0000-000000000000',
};

async function main() {
  console.log('🌱 Seeding demo attendance data...');

  // ===== جدول العمل الافتراضي =====
  const schedule = await (prisma as any).workSchedule.upsert({
    where: { id: 'ws000001-0000-0000-0000-000000000000' },
    update: {},
    create: {
      id: 'ws000001-0000-0000-0000-000000000000',
      nameAr: 'الدوام الرسمي',
      nameEn: 'Official Hours',
      workDays: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'],
      startTime: '08:00',
      endTime: '16:00',
      flexibleMinutes: 15,
      isDefault: true,
    },
  }).catch(() => null);

  if (schedule) {
    console.log('✅ Work schedule');

    // ربط الموظفين بالجدول
    for (const empId of Object.values(EMP)) {
      await (prisma as any).employeeSchedule.upsert({
        where: { employeeId: empId },
        update: {},
        create: { employeeId: empId, workScheduleId: 'ws000001-0000-0000-0000-000000000000', effectiveFrom: new Date('2026-01-01') },
      }).catch(() => {});
    }
    console.log('✅ Employee schedules');
  }

  // ===== سجلات حضور تجريبية (أسبوع 2026-04-06 إلى 2026-04-10) =====
  const week = [
    new Date('2026-04-06'), new Date('2026-04-07'),
    new Date('2026-04-08'), new Date('2026-04-09'), new Date('2026-04-10'),
  ];

  for (const empId of Object.values(EMP)) {
    for (const day of week) {
      const dateStr = day.toISOString().split('T')[0];
      const checkIn  = new Date(`${dateStr}T08:05:00Z`);
      const checkOut = new Date(`${dateStr}T16:10:00Z`);

      await (prisma as any).attendanceRecord.upsert({
        where: { employeeId_date: { employeeId: empId, date: day } },
        update: {},
        create: {
          employeeId: empId,
          date: day,
          checkIn,
          checkOut,
          status: 'PRESENT',
          workMinutes: 485,
          lateMinutes: 5,
          source: 'MANUAL',
        },
      }).catch(() => {});
    }
  }

  // يوم غياب لعمر
  await (prisma as any).attendanceRecord.upsert({
    where: { employeeId_date: { employeeId: EMP.omar, date: new Date('2026-04-09') } },
    update: { status: 'ABSENT', checkIn: null, checkOut: null },
    create: {
      employeeId: EMP.omar,
      date: new Date('2026-04-09'),
      status: 'ABSENT',
      workMinutes: 0,
      source: 'MANUAL',
    },
  }).catch(() => {});

  console.log('✅ Attendance records (5 employees × 5 days, 1 absence for Omar)');
  console.log('🎉 Attendance demo seed completed!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
